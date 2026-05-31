<?php

namespace Tests\Feature;

use App\Mail\ApprovalRequestMail;
use App\Mail\DocumentStatusMail;
use App\Models\Approval;
use App\Models\ApprovalConfig;
use App\Models\CostCenter;
use App\Models\PrItem;
use App\Models\PurchaseRequisition;
use App\Models\RolePermission;
use App\Models\Tenant;
use App\Models\User;
use App\Services\ApprovalService;
use App\Services\TokenService;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Email notifications + one-click email approval + login throttle.
 */
class MailApprovalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private CostCenter $cc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        Mail::fake();

        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->cc   = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    private function makePr(string $status = 'submitted'): PurchaseRequisition
    {
        $pr = PurchaseRequisition::create([
            'tenant_id'        => $this->acme->id,
            'cost_center_id'   => $this->cc->id,
            'pr_ref'           => 'PR-TEST-' . uniqid(),
            'title'            => 'Office Supplies PR',
            'description'      => 'Quarterly office supplies',
            'estimated_amount' => 1500,
            'priority'         => 'normal',
            'status'           => $status,
            'requested_by'     => $this->user('cbuyer@acmetest.com')->id,
        ]);

        PrItem::create([
            'pr_id' => $pr->id, 'sno' => 1, 'description' => 'A4 Paper Ream',
            'qty' => 10, 'unit' => 'Nos', 'estimated_price' => 250,
        ]);
        PrItem::create([
            'pr_id' => $pr->id, 'sno' => 2, 'description' => 'Stapler Heavy Duty',
            'qty' => 5, 'unit' => 'Nos', 'estimated_price' => 400,
        ]);

        return $pr;
    }

    private function pendingApproval(PurchaseRequisition $pr, string $approverEmail): Approval
    {
        return Approval::create([
            'entity_type'         => 'PR',
            'entity_id'           => $pr->id,
            'level'               => 1,
            'assigned_to_user_id' => $this->user($approverEmail)->id,
            'action'              => 'pending',
        ]);
    }

    // ── 1. Mail content: line items + PDF + one-click links ───────────────────

    public function test_approval_request_mail_has_line_items_pdf_and_action_links(): void
    {
        $pr       = $this->makePr();
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');

        $mail = new ApprovalRequestMail($approval, 'PR', $pr->load('items', 'costCenter', 'requestedBy'));
        $html = $mail->render();

        // Line items detailed in body
        $this->assertStringContainsString('A4 Paper Ream', $html);
        $this->assertStringContainsString('Stapler Heavy Duty', $html);
        // One-click public action links (no login)
        $this->assertStringContainsString('/api/email/approval/', $mail->approveUrl);
        $this->assertStringContainsString('/approve', $mail->approveUrl);
        $this->assertStringContainsString('/reject', $mail->rejectUrl);
        // PDF attachment present
        $this->assertCount(1, $mail->attachments());
    }

    // ── 2. Approver is intimated when a PR is routed for approval ─────────────

    public function test_routing_pr_notifies_assigned_approver(): void
    {
        ApprovalConfig::create([
            'cost_center_id' => $this->cc->id, 'type' => 'pr', 'level' => 1,
            'user_id' => $this->user('cl1@acmetest.com')->id, 'is_active' => true,
        ]);

        $pr = $this->makePr('submitted');

        app(ApprovalService::class)->routePrForApproval($pr);

        $this->assertEquals('pending_l1', $pr->fresh()->status);
        Mail::assertQueued(ApprovalRequestMail::class, function ($m) {
            return $m->hasTo('cl1@acmetest.com');
        });
    }

    // ── 3. Rejection is intimated to the source (requester) ───────────────────

    public function test_rejection_notifies_source(): void
    {
        $pr       = $this->makePr('pending_l1');
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');

        app(ApprovalService::class)->reject($approval, 'Budget not available this quarter.');

        $this->assertEquals('rejected', $pr->fresh()->status);
        // The PR requester (cbuyer) must be notified.
        Mail::assertQueued(DocumentStatusMail::class, function ($m) {
            return $m->hasTo('cbuyer@acmetest.com') && $m->event === 'rejected';
        });
    }

    // ── 4. One-click approve from email (no login) ────────────────────────────

    public function test_public_approve_link_approves_without_login(): void
    {
        $pr       = $this->makePr('pending_l1');
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');
        $token    = app(TokenService::class)->generate($approval, 'approve');

        $this->get("/api/email/approval/{$token}/approve")
            ->assertStatus(200)
            ->assertSee('Approved');

        $this->assertEquals('approved', $approval->fresh()->action);
    }

    public function test_public_approve_link_is_single_use(): void
    {
        $pr       = $this->makePr('pending_l1');
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');
        $token    = app(TokenService::class)->generate($approval, 'approve');

        $this->get("/api/email/approval/{$token}/approve")->assertStatus(200);

        // Second use is rejected with a friendly page; action stays 'approved'.
        $this->get("/api/email/approval/{$token}/approve")
            ->assertStatus(200)
            ->assertSee('expired');

        $this->assertEquals('approved', $approval->fresh()->action);
    }

    // ── 5. One-click reject from email (reason form → submit) ─────────────────

    public function test_public_reject_shows_form_then_rejects(): void
    {
        $pr       = $this->makePr('pending_l1');
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');
        $token    = app(TokenService::class)->generate($approval, 'reject');

        $this->get("/api/email/approval/{$token}/reject")
            ->assertStatus(200)
            ->assertSee('Reject this document');

        $this->post("/api/email/approval/{$token}/reject", ['remarks' => 'Wrong vendor selected.'])
            ->assertStatus(200)
            ->assertSee('Rejected');

        $this->assertEquals('rejected', $approval->fresh()->action);
        $this->assertEquals('rejected', $pr->fresh()->status);
    }

    public function test_public_reject_requires_a_reason(): void
    {
        $pr       = $this->makePr('pending_l1');
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');
        $token    = app(TokenService::class)->generate($approval, 'reject');

        $this->post("/api/email/approval/{$token}/reject", ['remarks' => ''])
            ->assertStatus(200)
            ->assertSee('reason'); // form re-rendered with validation message

        $this->assertEquals('pending', $approval->fresh()->action);
    }

    // ── 6. Login brute-force throttling ───────────────────────────────────────

    public function test_login_is_rate_limited(): void
    {
        $payload = ['email' => 'cbuyer@acmetest.com', 'password' => 'wrong-password'];

        // throttle:6,1 — first 6 are allowed (and fail auth), the 7th is blocked.
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', $payload);
        }

        $this->postJson('/api/auth/login', $payload)->assertStatus(429);
    }

    // ── 7. Approval endpoint honours the permission matrix ────────────────────

    public function test_approval_endpoint_blocked_when_permission_revoked(): void
    {
        // Revoke 'approvals' edit for client_approver_l1.
        RolePermission::updateOrCreate(
            ['role' => 'client_approver_l1', 'module' => 'approvals'],
            ['can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
        );
        Cache::flush();

        $pr       = $this->makePr('pending_l1');
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');

        Sanctum::actingAs($this->user('cl1@acmetest.com'));
        $this->withHeader('X-Tenant-ID', (string) $this->acme->id)
            ->postJson("/api/approvals/{$approval->id}/approve")
            ->assertStatus(403);

        $this->assertEquals('pending', $approval->fresh()->action);
    }

    public function test_assigned_approver_can_approve_by_default(): void
    {
        $pr       = $this->makePr('pending_l1');
        $approval = $this->pendingApproval($pr, 'cl1@acmetest.com');

        Sanctum::actingAs($this->user('cl1@acmetest.com'));
        $this->withHeader('X-Tenant-ID', (string) $this->acme->id)
            ->postJson("/api/approvals/{$approval->id}/approve")
            ->assertStatus(200);

        $this->assertEquals('approved', $approval->fresh()->action);
    }
}
