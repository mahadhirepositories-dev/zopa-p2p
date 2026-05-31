<?php

namespace Tests\Feature;

use App\Models\CostCenter;
use App\Models\RolePermission;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Authorization & cybersecurity test suite.
 *
 * Covers, for all roles:
 *   - Authentication enforcement (401)
 *   - Tenant scoping / isolation / IDOR (400, 403)
 *   - Super-admin-only route protection (403)
 *   - Server-side enforcement of the Access Control permission matrix (403)
 *   - Super Admin permission immutability
 *   - Regression: allowed actions still succeed
 */
class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush(); // permissions are cached; start each test clean
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function tenantId(string $code): int
    {
        return Tenant::where('code', $code)->value('id');
    }

    /** Authenticate as the given user and scope to a tenant via header. */
    private function asUser(string $email, string $tenantCode = 'ACME'): self
    {
        $user = User::where('email', $email)->firstOrFail();
        Sanctum::actingAs($user);
        return $this->withHeader('X-Tenant-ID', (string) $this->tenantId($tenantCode));
    }

    private function revokeMatrix(string $role, string $module, array $flags): void
    {
        RolePermission::updateOrCreate(
            ['role' => $role, 'module' => $module],
            $flags + ['can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
        );
        Cache::flush();
    }

    // ── 1. Authentication ─────────────────────────────────────────────────────

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/purchase-requisitions')
            ->assertStatus(401);
    }

    public function test_authenticated_request_without_tenant_header_is_rejected(): void
    {
        Sanctum::actingAs(User::where('email', 'cadmin@acmetest.com')->first());
        $this->getJson('/api/purchase-requisitions')
            ->assertStatus(400)
            ->assertJsonFragment(['error' => 'X-Tenant-ID header is required']);
    }

    // ── 2. Tenant isolation / IDOR ────────────────────────────────────────────

    public function test_user_cannot_scope_to_a_tenant_they_are_not_assigned_to(): void
    {
        // Acme admin tries to act under Globex's tenant id.
        $this->asUser('cadmin@acmetest.com', 'GLBX')
            ->getJson('/api/purchase-requisitions')
            ->assertStatus(403);
    }

    public function test_cross_tenant_record_access_is_blocked_idor(): void
    {
        // A cost center that belongs to Acme...
        $acmeCc = CostCenter::where('tenant_id', $this->tenantId('ACME'))->firstOrFail();

        // ...must not be reachable by a Globex admin (direct object reference).
        $this->asUser('admin@globextest.com', 'GLBX')
            ->getJson("/api/cost-centers/{$acmeCc->id}")
            ->assertStatus(403);
    }

    // ── 3. Super-admin-only routes ────────────────────────────────────────────

    public function test_admin_routes_blocked_for_zopa_buyer(): void
    {
        Sanctum::actingAs(User::where('email', 'zbuyer@zopatest.com')->first());
        $this->getJson('/api/admin/role-permissions')->assertStatus(403);
    }

    public function test_admin_routes_blocked_for_client_admin(): void
    {
        Sanctum::actingAs(User::where('email', 'cadmin@acmetest.com')->first());
        $this->getJson('/api/admin/role-permissions')->assertStatus(403);
    }

    public function test_super_admin_can_read_permission_matrix(): void
    {
        Sanctum::actingAs(User::where('email', 'superadmin@zopatest.com')->first());
        $this->getJson('/api/admin/role-permissions')
            ->assertStatus(200)
            ->assertJsonStructure(['matrix', 'roles', 'modules']);
    }

    // ── 4. Permission-matrix server-side enforcement (the headline) ───────────

    public function test_client_buyer_can_create_pr_by_default(): void
    {
        // Empty body passes the authz gate and fails validation → proves the
        // role is permitted to reach the create action.
        $this->asUser('cbuyer@acmetest.com')
            ->postJson('/api/purchase-requisitions', [])
            ->assertStatus(422);
    }

    public function test_revoking_pr_create_blocks_client_buyer_on_the_api(): void
    {
        // Revoke create (and everything) for client_buyer on PR.
        $this->revokeMatrix('client_buyer', 'purchase_requisitions', []);

        // The very same request that returned 422 above must now be 403 —
        // proving enforcement happens on the server, not just in Angular.
        $this->asUser('cbuyer@acmetest.com')
            ->postJson('/api/purchase-requisitions', [])
            ->assertStatus(403);
    }

    public function test_revoking_via_admin_endpoint_is_enforced_end_to_end(): void
    {
        // Super admin revokes PR create for client_buyer through the real API.
        Sanctum::actingAs(User::where('email', 'superadmin@zopatest.com')->first());
        $this->putJson('/api/admin/role-permissions/client_buyer', [
            'modules' => [
                'purchase_requisitions' => [
                    'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false,
                ],
            ],
        ])->assertStatus(200);

        // client_buyer is now blocked from creating PRs.
        $this->asUser('cbuyer@acmetest.com')
            ->postJson('/api/purchase-requisitions', [])
            ->assertStatus(403);
    }

    public function test_revoking_product_create_blocks_client_admin(): void
    {
        $this->revokeMatrix('client_admin', 'products', ['can_view' => true]);

        $this->asUser('cadmin@acmetest.com')
            ->postJson('/api/products', [])
            ->assertStatus(403);
    }

    // ── 5. Default matrix mirrors legacy coarse roles ─────────────────────────

    public function test_approver_role_cannot_create_pr(): void
    {
        // Approvers were never transactional; default matrix keeps it that way.
        $this->asUser('cl1@acmetest.com')
            ->postJson('/api/purchase-requisitions', [])
            ->assertStatus(403);
    }

    public function test_buyer_cannot_create_master_data_by_default(): void
    {
        // client_buyer has products view but not create (mirrors old isAdmin gate).
        $this->asUser('cbuyer@acmetest.com')
            ->postJson('/api/products', [])
            ->assertStatus(403);
    }

    // ── 6. Super Admin immutability ───────────────────────────────────────────

    public function test_super_admin_permissions_cannot_be_modified(): void
    {
        Sanctum::actingAs(User::where('email', 'superadmin@zopatest.com')->first());
        $this->putJson('/api/admin/role-permissions/zopa_super_admin', [
            'modules' => [
                'purchase_requisitions' => [
                    'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false,
                ],
            ],
        ])->assertStatus(422);
    }

    public function test_super_admin_bypasses_revoked_matrix(): void
    {
        // Even if a row says super admin can't create, code-level rule wins.
        RolePermission::updateOrCreate(
            ['role' => 'zopa_super_admin', 'module' => 'purchase_requisitions'],
            ['can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
        );
        Cache::flush();

        // Super admin still reaches the create action (422 = passed gate).
        $this->asUser('superadmin@zopatest.com', 'ZOPA')
            ->postJson('/api/purchase-requisitions', [])
            ->assertStatus(422);
    }

    // ── 7. Regression: allowed actions still succeed ──────────────────────────

    public function test_client_admin_can_create_master_data(): void
    {
        $this->asUser('cadmin@acmetest.com')
            ->postJson('/api/departments', ['name' => 'New Test Dept'])
            ->assertStatus(201)
            ->assertJsonFragment(['name' => 'New Test Dept']);
    }

    public function test_client_admin_can_create_cost_center(): void
    {
        $this->asUser('cadmin@acmetest.com')
            ->postJson('/api/cost-centers', [
                'name'                => 'New CC',
                'annual_budget'       => 500000,
                'current_fiscal_year' => (int) date('Y'),
            ])
            ->assertStatus(201);
    }

    // ── 8. Public matrix endpoint ─────────────────────────────────────────────

    public function test_authenticated_user_can_fetch_permission_matrix(): void
    {
        Sanctum::actingAs(User::where('email', 'cbuyer@acmetest.com')->first());
        $res = $this->getJson('/api/role-permissions')->assertStatus(200);

        // Should contain an entry for the caller's role.
        $this->assertArrayHasKey('client_buyer', $res->json());
        $this->assertArrayHasKey('purchase_requisitions', $res->json()['client_buyer']);
    }
}
