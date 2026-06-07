<?php

namespace Tests\Feature;

use App\Models\{PurchaseOrder, PoItem, CostCenter, Tenant, User, Vendor,
                BudgetLedger, Grn, GrnItem, Approval, EmailActionToken, TatRecord};
use App\Services\BudgetService;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ResetPoToDraftTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_to_draft_reverses_all_side_effects(): void
    {
        $this->seed(TestDataSeeder::class);
        Cache::flush();

        $acme = Tenant::where('code', 'ACME')->firstOrFail();
        $cc   = CostCenter::where('tenant_id', $acme->id)->firstOrFail();
        $cc->update(['annual_budget' => 5_000_000]);
        $vendorId = Vendor::query()->value('id');
        $uid      = User::where('email', 'cadmin@acmetest.com')->value('id');
        $budget   = app(BudgetService::class);
        $fy       = $budget->currentFiscalYear($cc->fresh('tenant'));

        // A fully-delivered PO with every downstream side effect.
        $po = PurchaseOrder::create([
            'tenant_id' => $acme->id, 'cost_center_id' => $cc->id, 'vendor_id' => $vendorId,
            'status' => 'delivered', 'po_number' => '2605/03/ACME-PO-2026-0001', 'po_date' => now(),
            'approved_by' => $uid, 'approved_at' => now(), 'released_at' => now(), 'delivered_at' => now(),
            'net_total' => 200, 'tax_amount' => 36, 'grand_total' => 236, 'freight' => 0, 'created_by' => $uid,
        ]);
        $item = PoItem::create([
            'po_id' => $po->id, 'sno' => 1, 'description' => 'Item', 'qty' => 2,
            'net_rate' => 100, 'gst_rate' => 18, 'gross_rate' => 118, 'amount' => 236,
        ]);
        $budget->freeze($cc->id, $fy, 236, 'PO', $po->id, $uid, 'frozen on submit');
        $grn  = Grn::create(['tenant_id' => $acme->id, 'po_id' => $po->id, 'grn_number' => 'GRN-1',
            'received_date' => now(), 'received_by' => $uid, 'status' => 'confirmed']);
        GrnItem::create(['grn_id' => $grn->id, 'po_item_id' => $item->id,
            'received_qty' => 2, 'accepted_qty' => 2, 'rejected_qty' => 0]);
        $appr = Approval::create(['entity_type' => 'PO', 'entity_id' => $po->id, 'level' => 1,
            'assigned_to_user_id' => $uid, 'action' => 'approved']);
        EmailActionToken::create(['token' => 'tok-123', 'approval_id' => $appr->id, 'action' => 'approve',
            'approver_id' => $uid, 'expires_at' => now()->addDay()]);
        TatRecord::create(['po_id' => $po->id, 'po_created_at' => now()->subDays(3),
            'po_approved_at' => now()->subDays(2), 'po_released_at' => now()->subDay(), 'po_delivered_at' => now()]);

        // Sanity: the freeze reduced available budget.
        $this->assertEquals(5_000_000 - 236, $budget->getAvailable($cc->id, $fy)['available']);

        $this->artisan('po:reset-to-draft', ['id' => $po->id, '--force' => true])->assertExitCode(0);

        // PO back to a clean draft.
        $po->refresh();
        $this->assertSame('draft', $po->status);
        $this->assertNull($po->po_number);
        $this->assertNull($po->approved_at);
        $this->assertNull($po->released_at);
        $this->assertNull($po->delivered_at);

        // Budget fully restored; ledger entry gone.
        $this->assertEquals(5_000_000.0, $budget->getAvailable($cc->id, $fy)['available']);
        $this->assertSame(0, BudgetLedger::where('reference_type', 'PO')->where('reference_id', $po->id)->count());

        // GRN, approvals, tokens removed.
        $this->assertSame(0, Grn::where('po_id', $po->id)->count());
        $this->assertSame(0, GrnItem::where('grn_id', $grn->id)->count());
        $this->assertSame(0, Approval::where('entity_type', 'PO')->where('entity_id', $po->id)->count());
        $this->assertSame(0, EmailActionToken::where('approval_id', $appr->id)->count());

        // TAT: lifecycle stamps cleared, creation timestamp preserved.
        $tat = TatRecord::where('po_id', $po->id)->first();
        $this->assertNotNull($tat->po_created_at);
        $this->assertNull($tat->po_approved_at);
        $this->assertNull($tat->po_delivered_at);
    }

    public function test_dry_run_changes_nothing(): void
    {
        $this->seed(TestDataSeeder::class);
        $acme = Tenant::where('code', 'ACME')->firstOrFail();
        $cc   = CostCenter::where('tenant_id', $acme->id)->firstOrFail();
        $po = PurchaseOrder::create([
            'tenant_id' => $acme->id, 'cost_center_id' => $cc->id, 'vendor_id' => Vendor::query()->value('id'),
            'status' => 'delivered', 'po_number' => 'X/1', 'grand_total' => 100,
            'created_by' => User::where('email', 'cadmin@acmetest.com')->value('id'),
        ]);

        $this->artisan('po:reset-to-draft', ['id' => $po->id])->assertExitCode(0);

        $this->assertSame('delivered', $po->refresh()->status);  // unchanged without --force
    }
}
