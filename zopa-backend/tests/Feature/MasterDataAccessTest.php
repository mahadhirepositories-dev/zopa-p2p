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
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Master-data create/edit is governed by the Access Control matrix, not a coarse
 * "admin only" gate. ZOPA and client buyers can create and edit them by default;
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

    public function test_client_buyer_can_create_and_edit_masters_but_not_delete_by_default(): void
    {
        $this->actAs('cbuyer@acmetest.com');
        $h = $this->tenantHeaders();

        $vendorId = $this->withHeaders($h)->postJson('/api/vendors', ['name' => 'Client-added Vendor'])->assertStatus(201)->json('id');
        $this->withHeaders($h)->postJson('/api/products', ['name' => 'Bolt', 'unit' => 'Nos', 'net_rate' => 10, 'gst_rate' => 18])->assertStatus(201);
        $this->withHeaders($h)->postJson('/api/locations', ['name' => 'Plant 1'])->assertStatus(201);
        $this->withHeaders($h)->postJson('/api/cost-centers', ['name' => 'Ops', 'annual_budget' => 100000, 'current_fiscal_year' => (int) date('Y')])->assertStatus(201);

        $this->withHeaders($h)->putJson("/api/vendors/{$vendorId}", ['name' => 'Renamed Vendor'])->assertStatus(200);
        $this->withHeaders($h)->deleteJson("/api/vendors/{$vendorId}")->assertStatus(403);
    }

    public function test_client_buyer_blocked_when_matrix_revokes_create(): void
    {
        RolePermission::updateOrCreate(
            ['role' => 'client_buyer', 'module' => 'vendors'],
            ['can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
        );
        Cache::flush();

        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->tenantHeaders())
            ->postJson('/api/vendors', ['name' => 'X'])
            ->assertStatus(403);
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

    public static function budgetChangesByNonAdmins(): array
    {
        return [
            'client buyer raises it'    => ['cbuyer@acmetest.com', 2000000],
            'zopa buyer raises it'      => ['zbuyer@zopatest.com', 2000000],
            'raised by one paisa'       => ['zbuyer@zopatest.com', 1000000.01],
            'zeroed'                    => ['zbuyer@zopatest.com', 0],
        ];
    }

    #[DataProvider('budgetChangesByNonAdmins')]
    public function test_non_admin_cannot_change_annual_budget_through_update(string $email, int|float $budget): void
    {
        $cc = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();
        $originalName = $cc->name;

        $this->actAs($email)
            ->withHeaders($this->tenantHeaders())
            ->putJson("/api/cost-centers/{$cc->id}", ['name' => 'Renamed', 'annual_budget' => $budget])
            ->assertStatus(403);

        $cc->refresh();
        $this->assertSame('1000000.00', $cc->annual_budget);
        $this->assertSame($originalName, $cc->name, 'A rejected budget change must not save the other fields');
    }

    public static function nonAdminEditors(): array
    {
        return [
            'client buyer' => ['cbuyer@acmetest.com'],
            'zopa buyer'   => ['zbuyer@zopatest.com'],
        ];
    }

    #[DataProvider('nonAdminEditors')]
    public function test_non_admin_can_edit_other_fields_when_budget_is_unchanged(string $email): void
    {
        $cc  = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();
        $url = "/api/cost-centers/{$cc->id}";
        $this->actAs($email)->withHeaders($this->tenantHeaders());

        // The edit form always resends the budget: as the API's "1000000.00" string when
        // the field is untouched, or as a number once it has been retyped.
        $untouched = $this->getJson($url)->assertOk()->json('annual_budget');

        $this->putJson($url, ['name' => 'Untouched', 'annual_budget' => $untouched])
            ->assertOk()->assertJsonPath('name', 'Untouched');
        $this->putJson($url, ['name' => 'Retyped', 'annual_budget' => 1000000])
            ->assertOk()->assertJsonPath('name', 'Retyped');
        $this->putJson($url, ['name' => 'Not sent'])
            ->assertOk()->assertJsonPath('name', 'Not sent');

        $this->assertSame('1000000.00', $cc->fresh()->annual_budget);
    }

    public static function admins(): array
    {
        return [
            'client admin' => ['cadmin@acmetest.com'],
            'super admin'  => ['superadmin@zopatest.com'],
        ];
    }

    #[DataProvider('admins')]
    public function test_admin_can_change_annual_budget_through_update(string $email): void
    {
        $cc = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();

        $this->actAs($email)
            ->withHeaders($this->tenantHeaders())
            ->putJson("/api/cost-centers/{$cc->id}", ['annual_budget' => 2000000])
            ->assertOk();

        $this->assertSame('2000000.00', $cc->fresh()->annual_budget);
    }
}
