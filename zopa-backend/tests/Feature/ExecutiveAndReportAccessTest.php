<?php

namespace Tests\Feature;

use App\Models\{CostCenter, OperationalReport, PurchaseRequisition, RolePermission, Tenant, User};
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The executive dashboard and operational report APIs hand out only what the
 * Access Control matrix allows, whatever the screens happen to show.
 */
class ExecutiveAndReportAccessTest extends TestCase
{
    use RefreshDatabase;

    private const DENIED = ['cpr@acmetest.com', 'cgrn@acmetest.com'];

    private Tenant $acme;
    private Tenant $globex;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        Mail::fake();
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->globex = Tenant::where('code', 'GLBX')->firstOrFail();
    }

    private function as(string $email, ?Tenant $tenant = null): static
    {
        Sanctum::actingAs(User::where('email', $email)->firstOrFail());

        return $this->withHeaders(['X-Tenant-ID' => (string) ($tenant ?? $this->acme)->id]);
    }

    private function report(?Tenant $tenant = null, array $attrs = []): OperationalReport
    {
        return OperationalReport::create($attrs + [
            'tenant_id' => ($tenant ?? $this->acme)->id,
            'created_by' => User::where('email', 'cadmin@acmetest.com')->value('id'),
            'title' => 'Weekly report',
            'status' => 'draft',
            'metrics_data' => ['pos_issued_value' => 987654],
        ]);
    }

    private function pr(array $attrs = []): PurchaseRequisition
    {
        return PurchaseRequisition::create($attrs + [
            'tenant_id' => $this->acme->id,
            'cost_center_id' => CostCenter::where('tenant_id', $this->acme->id)->value('id'),
            'pr_ref' => uniqid('PR-'),
            'requested_by' => User::where('email', 'cadmin@acmetest.com')->value('id'),
            'title' => 'Live requisition',
            'status' => 'submitted',
        ]);
    }

    private function grant(string $role, string $module, array $flags): void
    {
        RolePermission::updateOrCreate(['role' => $role, 'module' => $module], $flags);
        Cache::flush();
    }

    // ── Executive dashboard ─────────────────────────────────────────────────

    public function test_pr_and_grn_users_cannot_read_executive_figures(): void
    {
        foreach (self::DENIED as $email) {
            $this->as($email)->getJson('/api/executive-dashboard/stats')
                ->assertForbidden()
                ->assertJsonMissingPath('total_value_managed');
        }
    }

    public function test_pr_and_grn_users_cannot_export_executive_figures(): void
    {
        foreach (self::DENIED as $email) {
            $this->as($email)->get('/api/executive-dashboard/export')->assertForbidden();
        }
    }

    public function test_roles_with_po_view_keep_the_executive_dashboard(): void
    {
        foreach (['cadmin@acmetest.com', 'cbuyer@acmetest.com', 'cl1@acmetest.com', 'zbuyer@zopatest.com'] as $email) {
            $this->as($email)->getJson('/api/executive-dashboard/stats')
                ->assertOk()
                ->assertJsonPath('user_scope.tenant_id', $this->acme->id);
            $this->as($email)->get('/api/executive-dashboard/export')->assertOk();
        }
    }

    public function test_super_admin_keeps_the_all_organizations_view(): void
    {
        $this->as('superadmin@zopatest.com')->getJson('/api/executive-dashboard/stats')
            ->assertOk()
            ->assertJsonPath('user_scope.is_zopa_admin', true)
            ->assertJsonPath('user_scope.tenant_id', 0);
    }

    public function test_revoking_executive_dashboard_view_in_access_control_is_enforced(): void
    {
        $this->as('cadmin@acmetest.com')->getJson('/api/executive-dashboard/stats')->assertOk();

        $this->grant('client_admin', 'executive_dashboard', ['can_view' => false]);

        $this->as('cadmin@acmetest.com')->getJson('/api/executive-dashboard/stats')->assertForbidden();
        $this->as('cadmin@acmetest.com')->get('/api/executive-dashboard/export')->assertForbidden();
    }

    public function test_a_role_with_no_matrix_rows_is_still_denied_po_figures(): void
    {
        RolePermission::where('role', 'client_pr')->delete();
        Cache::flush();

        $this->as('cpr@acmetest.com')->getJson('/api/executive-dashboard/stats')->assertForbidden();
    }

    public function test_pr_list_needs_pr_view_as_well(): void
    {
        $this->pr(['title' => 'Sensitive requisition']);
        $this->as('cadmin@acmetest.com')->getJson('/api/executive-dashboard/stats')
            ->assertJsonPath('pending_pr_tracking.0.title', 'Sensitive requisition');

        $this->grant('client_admin', 'purchase_requisitions', ['can_view' => false]);

        $this->as('cadmin@acmetest.com')->getJson('/api/executive-dashboard/stats')
            ->assertOk()
            ->assertJsonPath('pending_pr_tracking', []);
    }

    // ── Operational reports: reads ──────────────────────────────────────────

    public function test_pr_and_grn_users_cannot_read_reports(): void
    {
        $report = $this->report();

        foreach (self::DENIED as $email) {
            $client = $this->as($email);
            $client->getJson('/api/operational-reports')->assertForbidden();
            $client->getJson('/api/operational-reports/approvers')->assertForbidden();
            $client->getJson("/api/operational-reports/{$report->id}")->assertForbidden();
            $client->get("/api/operational-reports/{$report->id}/pdf")->assertForbidden();
        }
    }

    public function test_view_only_roles_can_read_reports(): void
    {
        $report = $this->report();
        $client = $this->as('cl1@acmetest.com');

        $client->getJson('/api/operational-reports')->assertOk()->assertJsonPath('data.0.id', $report->id);
        $client->getJson('/api/operational-reports/approvers')->assertOk();
        $client->getJson("/api/operational-reports/{$report->id}")->assertOk();
        $client->get("/api/operational-reports/{$report->id}/pdf")->assertOk();
    }

    // ── Operational reports: writes ─────────────────────────────────────────

    public function test_pr_and_grn_users_cannot_change_reports(): void
    {
        $report = $this->report();

        foreach (self::DENIED as $email) {
            $client = $this->as($email);
            $client->postJson('/api/operational-reports/start')->assertForbidden();
            $client->putJson("/api/operational-reports/{$report->id}", ['title' => 'Hacked'])->assertForbidden();
            $client->postJson("/api/operational-reports/{$report->id}/send", ['recipient_email' => 'x@example.com'])->assertForbidden();
            $client->deleteJson("/api/operational-reports/{$report->id}")->assertForbidden();
        }

        $this->assertSame('Weekly report', $report->fresh()->title);
        $this->assertSame('draft', $report->fresh()->status);
        Mail::assertNothingSent();
    }

    public function test_view_only_roles_cannot_change_reports(): void
    {
        $report = $this->report();
        $client = $this->as('cl1@acmetest.com');

        $client->postJson('/api/operational-reports/start')->assertForbidden();
        $client->putJson("/api/operational-reports/{$report->id}", ['title' => 'Hacked'])->assertForbidden();
        $client->postJson("/api/operational-reports/{$report->id}/send", ['recipient_email' => 'x@example.com'])->assertForbidden();
        $client->deleteJson("/api/operational-reports/{$report->id}")->assertForbidden();

        $this->assertNotNull($report->fresh());
        Mail::assertNothingSent();
    }

    /** Buyers write these reports (Help: "Generating & Mailing Operational Reports"). */
    public function test_buyers_can_start_edit_and_send_but_not_delete_reports(): void
    {
        foreach (['cbuyer@acmetest.com', 'zbuyer@zopatest.com'] as $email) {
            $client = $this->as($email);
            $id = $client->postJson('/api/operational-reports/start')->assertCreated()->json('report.id');

            $client->putJson("/api/operational-reports/{$id}", ['title' => 'Edited'])->assertOk();
            $client->postJson("/api/operational-reports/{$id}/send", ['recipient_email' => 'x@example.com'])->assertOk();
            $client->deleteJson("/api/operational-reports/{$id}")->assertForbidden();

            $this->assertSame('sent', OperationalReport::findOrFail($id)->status);
        }
    }

    public function test_migration_gives_buyers_report_writes_but_respects_a_revoked_view(): void
    {
        $this->grant('client_buyer', 'reports', ['can_view' => true, 'can_create' => false, 'can_edit' => false]);
        $this->grant('zopa_buyer', 'reports', ['can_view' => false, 'can_create' => false, 'can_edit' => false]);

        (require database_path('migrations/2026_11_05_120000_grant_buyers_report_writes.php'))->up();

        $this->assertTrue((bool) RolePermission::where(['role' => 'client_buyer', 'module' => 'reports'])->value('can_edit'));
        $this->assertFalse((bool) RolePermission::where(['role' => 'zopa_buyer', 'module' => 'reports'])->value('can_edit'));
    }

    public function test_client_admin_and_super_admin_keep_full_access(): void
    {
        foreach (['cadmin@acmetest.com', 'superadmin@zopatest.com'] as $email) {
            $client = $this->as($email);
            $id = $client->postJson('/api/operational-reports/start')->assertCreated()->json('report.id');

            $client->getJson('/api/operational-reports')->assertOk();
            $client->getJson('/api/operational-reports/approvers')->assertOk();
            $client->getJson("/api/operational-reports/{$id}")->assertOk();
            $client->get("/api/operational-reports/{$id}/pdf")->assertOk();
            $client->putJson("/api/operational-reports/{$id}", ['title' => 'Edited'])->assertOk();
            $client->postJson("/api/operational-reports/{$id}/send", ['recipient_email' => 'x@example.com'])->assertOk();
            $client->deleteJson("/api/operational-reports/{$id}")->assertOk();

            $this->assertNull(OperationalReport::find($id));
        }
    }

    public function test_saving_a_report_only_corrects_pr_status_with_pr_edit(): void
    {
        $pr = $this->pr();
        $report = $this->report();
        $rows = ['open_prs_data' => [['id' => $pr->id, 'status' => 'short_closed']]];

        // L1 holds PR view only, so report edit alone must not move the live PR.
        $this->grant('client_approver_l1', 'reports', ['can_view' => true, 'can_edit' => true]);
        $this->as('cl1@acmetest.com')->putJson("/api/operational-reports/{$report->id}", $rows)->assertOk();
        $this->assertSame('submitted', $pr->fresh()->status);

        $this->as('cbuyer@acmetest.com')->putJson("/api/operational-reports/{$report->id}", $rows)->assertOk();
        $this->assertSame('short_closed', $pr->fresh()->status);
    }

    // ── Operational reports: tenant isolation ───────────────────────────────

    public function test_another_organizations_report_stays_out_of_reach(): void
    {
        $report = $this->report($this->globex, ['title' => 'Globex report']);
        $client = $this->as('cadmin@acmetest.com');

        $client->getJson("/api/operational-reports/{$report->id}")->assertForbidden();
        $client->get("/api/operational-reports/{$report->id}/pdf")->assertForbidden();
        $client->putJson("/api/operational-reports/{$report->id}", ['title' => 'Hacked'])->assertForbidden();
        $client->postJson("/api/operational-reports/{$report->id}/send", ['recipient_email' => 'x@example.com'])->assertForbidden();
        $client->deleteJson("/api/operational-reports/{$report->id}")->assertForbidden();

        $this->assertSame('Globex report', $report->fresh()->title);
        Mail::assertNothingSent();
    }

    public function test_super_admin_reaches_a_report_through_its_own_organization(): void
    {
        $report = $this->report($this->globex);

        $this->as('superadmin@zopatest.com', $this->globex)
            ->getJson("/api/operational-reports/{$report->id}")->assertOk();
    }
}
