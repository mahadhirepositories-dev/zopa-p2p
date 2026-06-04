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
 * Master-data create/edit is governed by the Access Control matrix, not a coarse
 * "admin only" gate. A ZOPA Buyer (who manages client masters) can create them;
 * the matrix can still grant/revoke per role; financial actions stay admin-only.
 */
class MasterDataAccessTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
    }

    private function actAs(string $email): self
    {
        Sanctum::actingAs(User::where('email', $email)->firstOrFail());
        return $this;
    }

    private function tenantHeaders(): array
    {
        return ['X-Tenant-ID' => (string) $this->acme->id];
    }

    public function test_zopa_buyer_can_create_all_master_data(): void
    {
        $this->actAs('zbuyer@zopatest.com');
        $h = $this->tenantHeaders();

        $this->withHeaders($h)->postJson('/api/vendors', ['name' => 'Acme Supplier'])->assertStatus(201);
        $this->withHeaders($h)->postJson('/api/categories', ['name' => 'Hardware'])->assertStatus(201);
        $this->withHeaders($h)->postJson('/api/products', ['name' => 'Bolt', 'unit' => 'Nos', 'net_rate' => 10, 'gst_rate' => 18])->assertStatus(201);
        $this->withHeaders($h)->postJson('/api/locations', ['name' => 'Plant 1'])->assertStatus(201);
        $this->withHeaders($h)->postJson('/api/cost-centers', ['name' => 'Ops', 'annual_budget' => 100000, 'current_fiscal_year' => (int) date('Y')])->assertStatus(201);
    }

    public function test_zopa_buyer_blocked_when_matrix_revokes_create(): void
    {
        RolePermission::updateOrCreate(
            ['role' => 'zopa_buyer', 'module' => 'vendors'],
            ['can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
        );
        Cache::flush();

        $this->actAs('zbuyer@zopatest.com')
            ->withHeaders($this->tenantHeaders())
            ->postJson('/api/vendors', ['name' => 'X'])
            ->assertStatus(403);
    }

    public function test_client_buyer_is_view_only_on_masters_by_default(): void
    {
        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->tenantHeaders())
            ->postJson('/api/vendors', ['name' => 'X'])
            ->assertStatus(403);
    }

    public function test_matrix_grant_lets_client_buyer_create_a_vendor(): void
    {
        // Honor an explicit Access-Control grant for a buyer role.
        RolePermission::updateOrCreate(
            ['role' => 'client_buyer', 'module' => 'vendors'],
            ['can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => false],
        );
        Cache::flush();

        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->tenantHeaders())
            ->postJson('/api/vendors', ['name' => 'Client-added Vendor'])
            ->assertStatus(201);
    }

    public function test_matrix_grant_lets_any_role_create_master_data(): void
    {
        // Grant an APPROVER (outside the usual master-role family) create on vendors.
        // The Access Control matrix must be authoritative for EVERY role.
        RolePermission::updateOrCreate(
            ['role' => 'client_approver_l1', 'module' => 'vendors'],
            ['can_view' => true, 'can_create' => true, 'can_edit' => false, 'can_delete' => false],
        );
        Cache::flush();

        $this->actAs('cl1@acmetest.com')
            ->withHeaders($this->tenantHeaders())
            ->postJson('/api/vendors', ['name' => 'Approver-added Vendor'])
            ->assertStatus(201);
    }

    public function test_client_approver_cannot_create_master_data(): void
    {
        $this->actAs('cl1@acmetest.com')
            ->withHeaders($this->tenantHeaders())
            ->postJson('/api/products', ['name' => 'X', 'unit' => 'Nos', 'net_rate' => 1, 'gst_rate' => 0])
            ->assertStatus(403);
    }

    public function test_zopa_buyer_cannot_adjust_budget_financial_stays_admin(): void
    {
        $cc = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();

        $this->actAs('zbuyer@zopatest.com')
            ->withHeaders($this->tenantHeaders())
            ->postJson("/api/cost-centers/{$cc->id}/budget/adjust", ['action' => 'add', 'amount' => 1000, 'narration' => 'test'])
            ->assertStatus(403);
    }
}
