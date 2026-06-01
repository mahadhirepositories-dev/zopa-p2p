<?php

namespace Tests\Feature;

use App\Models\Approval;
use App\Models\ApprovalConfig;
use App\Models\CostCenter;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use App\Services\ApprovalService;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * The highest CONFIGURED & REQUIRED approval level is always the final approver.
 * Covers: only-L1, L1+L2 within L1's limit (no over-escalation), mid-level final,
 * highest-configured final when the amount exceeds every limit, and no-config
 * auto-approve.
 */
class ApprovalFinalizationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private CostCenter $cc;
    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        Mail::fake();

        $this->acme   = Tenant::where('code', 'ACME')->firstOrFail();
        $this->cc     = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();
        $this->vendor = Vendor::where('tenant_id', $this->acme->id)->firstOrFail();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    private function config(int $level, string $email, ?float $limit): void
    {
        ApprovalConfig::create([
            'cost_center_id' => $this->cc->id,
            'type'           => 'po',
            'level'          => $level,
            'user_id'        => $this->user($email)->id,
            'amount_limit'   => $limit,
            'is_active'      => true,
        ]);
    }

    private function makePo(float $amount): PurchaseOrder
    {
        return PurchaseOrder::create([
            'tenant_id'      => $this->acme->id,
            'cost_center_id' => $this->cc->id,
            'vendor_id'      => $this->vendor->id,
            'net_total'      => $amount,
            'tax_amount'     => 0,
            'grand_total'    => $amount,
            'status'         => 'draft',
            'created_by'     => $this->user('cbuyer@acmetest.com')->id,
        ]);
    }

    /** Approve the current pending level for a PO (as the configured approver). */
    private function approveLevel(PurchaseOrder $po, int $level): void
    {
        $approval = Approval::where('entity_type', 'PO')
            ->where('entity_id', $po->id)
            ->where('level', $level)
            ->where('action', 'pending')
            ->firstOrFail();

        app(ApprovalService::class)->approve($approval);
    }

    // ── Scenarios ─────────────────────────────────────────────────────────────

    public function test_only_l1_configured_means_l1_is_final(): void
    {
        $this->config(1, 'cl1@acmetest.com', null);

        $po = $this->makePo(5000);
        app(ApprovalService::class)->routeForApproval($po);
        $this->assertEquals('pending_l1', $po->fresh()->status);

        $this->approveLevel($po, 1);

        $fresh = $po->fresh();
        $this->assertEquals('approved', $fresh->status);
        $this->assertNotNull($fresh->po_number);
        $this->assertNotNull($fresh->approved_at);
    }

    public function test_amount_within_l1_limit_finalizes_at_l1_even_when_l2_exists(): void
    {
        // The regression: a low-value PO must NOT escalate to L2.
        $this->config(1, 'cl1@acmetest.com', 10000);
        $this->config(2, 'cl2@acmetest.com', 50000);

        $po = $this->makePo(5000);   // within L1's 10k limit
        app(ApprovalService::class)->routeForApproval($po);
        $this->assertEquals('pending_l1', $po->fresh()->status);

        $this->approveLevel($po, 1);

        // L1 is final — no L2 approval record should have been created.
        $this->assertEquals('approved', $po->fresh()->status);
        $this->assertFalse(
            Approval::where('entity_type', 'PO')->where('entity_id', $po->id)->where('level', 2)->exists(),
            'PO within L1 limit must not escalate to L2.'
        );
    }

    public function test_mid_level_is_final_when_amount_within_that_level(): void
    {
        $this->config(1, 'cl1@acmetest.com', 10000);
        $this->config(2, 'cl2@acmetest.com', 50000);
        $this->config(3, 'cl3@acmetest.com', null);

        $po = $this->makePo(30000);  // exceeds L1, within L2
        app(ApprovalService::class)->routeForApproval($po);

        $this->approveLevel($po, 1);
        $this->assertEquals('pending_l2', $po->fresh()->status);

        $this->approveLevel($po, 2);

        // L2 is final — must NOT escalate to L3.
        $this->assertEquals('approved', $po->fresh()->status);
        $this->assertFalse(
            Approval::where('entity_type', 'PO')->where('entity_id', $po->id)->where('level', 3)->exists(),
            'PO within L2 limit must not escalate to L3.'
        );
    }

    public function test_highest_configured_level_is_final_when_amount_exceeds_all_limits(): void
    {
        // No L3 configured; amount blows past L2's limit → L2 is still final.
        $this->config(1, 'cl1@acmetest.com', 10000);
        $this->config(2, 'cl2@acmetest.com', 50000);

        $po = $this->makePo(250000);
        app(ApprovalService::class)->routeForApproval($po);

        $this->approveLevel($po, 1);
        $this->assertEquals('pending_l2', $po->fresh()->status);

        $this->approveLevel($po, 2);
        $this->assertEquals('approved', $po->fresh()->status);
    }

    public function test_no_config_auto_approves(): void
    {
        $po = $this->makePo(9999);
        app(ApprovalService::class)->routeForApproval($po);

        $this->assertEquals('approved', $po->fresh()->status);
    }
}
