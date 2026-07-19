<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\CostCenter;
use App\Models\Department;
use App\Models\Location;
use App\Models\Product;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserTenantRole;
use App\Models\Vendor;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Idempotent test-data seeder for end-to-end / manual authorization testing.
 *
 *   php artisan db:seed --class=TestDataSeeder
 *
 * Creates:
 *   - Internal ZOPA tenant (super admin + ZOPA L3 live here per governance)
 *   - Two external client tenants (Acme, Globex) — Globex exists to prove
 *     tenant isolation: an Acme user must never see Globex data.
 *   - One user per role (all 10 roles), shared password below.
 *   - Minimal master data (dept/project/location/cost-center/vendor/product/category)
 *     in Acme so transactional flows can be exercised.
 *
 * Safe to re-run: every record is created with firstOrCreate / updateOrCreate.
 * It NEVER truncates, so it will not disturb existing production data.
 */
class TestDataSeeder extends Seeder
{
    public const PASSWORD = 'Test@12345';

    public function run(): void
    {
        // Ensure the permission matrix exists (idempotent).
        $this->call(RolePermissionSeeder::class);

        // ── Tenants ───────────────────────────────────────────────────────────
        $zopa = Tenant::firstOrCreate(
            ['code' => 'ZOPA'],
            [
                'name' => 'ZOPA Internal', 'gstin' => '', 'po_prefix' => 'PO',
                'fiscal_year_start' => 4, 'is_active' => true, 'is_internal' => true,
                'plan' => 'enterprise',
            ]
        );

        $acme = Tenant::firstOrCreate(
            ['code' => 'ACME'],
            [
                'name' => 'Acme Corporation', 'gstin' => '27AAACA1111A1Z5', 'po_prefix' => 'PO',
                'fiscal_year_start' => 4, 'is_active' => true, 'is_internal' => false,
                'plan' => 'pro',
            ]
        );

        $globex = Tenant::firstOrCreate(
            ['code' => 'GLBX'],
            [
                'name' => 'Globex Industries', 'gstin' => '29BBBCB2222B1Z4', 'po_prefix' => 'PO',
                'fiscal_year_start' => 4, 'is_active' => true, 'is_internal' => false,
                'plan' => 'basic',
            ]
        );

        // ── Users + role assignments ──────────────────────────────────────────
        // ZOPA staff (is_zopa_staff = true)
        $superAdmin = $this->user('Test Super Admin', 'superadmin@zopatest.com', true);
        $this->assign($superAdmin, $zopa, 'zopa_super_admin', $superAdmin);

        $zBuyer = $this->user('Test ZOPA Buyer', 'zbuyer@zopatest.com', true);
        $this->assign($zBuyer, $acme, 'zopa_buyer', $superAdmin);

        $zL1 = $this->user('Test ZOPA Approver L1', 'zl1@zopatest.com', true);
        $this->assign($zL1, $acme, 'zopa_approver_l1', $superAdmin);

        $zL2 = $this->user('Test ZOPA Approver L2', 'zl2@zopatest.com', true);
        $this->assign($zL2, $acme, 'zopa_approver_l2', $superAdmin);

        // Governance: a ZOPA staffer may only be L3 on an INTERNAL tenant.
        $zL3 = $this->user('Test ZOPA Approver L3', 'zl3@zopatest.com', true);
        $this->assign($zL3, $zopa, 'zopa_approver_l3', $superAdmin);
        
        $zPr = $this->user('Test ZOPA PR User', 'zpr@zopatest.com', true);
        $this->assign($zPr, $zopa, 'zopa_pr', $superAdmin);
        
        $zGrn = $this->user('Test ZOPA GRN User', 'zgrn@zopatest.com', true);
        $this->assign($zGrn, $zopa, 'zopa_grn', $superAdmin);

        // Client users for Acme (is_zopa_staff = false)
        $cAdmin = $this->user('Test Acme Admin', 'cadmin@acmetest.com', false);
        $this->assign($cAdmin, $acme, 'client_admin', $superAdmin);

        $cBuyer = $this->user('Test Acme Buyer', 'cbuyer@acmetest.com', false);
        $this->assign($cBuyer, $acme, 'client_buyer', $superAdmin);

        $cL1 = $this->user('Test Acme Approver L1', 'cl1@acmetest.com', false);
        $this->assign($cL1, $acme, 'client_approver_l1', $superAdmin);

        $cL2 = $this->user('Test Acme Approver L2', 'cl2@acmetest.com', false);
        $this->assign($cL2, $acme, 'client_approver_l2', $superAdmin);

        $cL3 = $this->user('Test Acme Approver L3', 'cl3@acmetest.com', false);
        $this->assign($cL3, $acme, 'client_approver_l3', $superAdmin);
        
        $cPr = $this->user('Test Acme PR User', 'cpr@acmetest.com', false);
        $this->assign($cPr, $acme, 'client_pr', $superAdmin);

        $cGrn = $this->user('Test Acme GRN User', 'cgrn@acmetest.com', false);
        $this->assign($cGrn, $acme, 'client_grn', $superAdmin);

        // A separate Globex admin — used to verify cross-tenant isolation.
        $globexAdmin = $this->user('Test Globex Admin', 'admin@globextest.com', false);
        $this->assign($globexAdmin, $globex, 'client_admin', $superAdmin);

        // ── Minimal master data (Acme + Globex) ───────────────────────────────
        $this->masterData($acme);
        $this->masterData($globex);

        $this->report();
    }

    private function user(string $name, string $email, bool $isZopaStaff): User
    {
        return User::firstOrCreate(
            ['email' => $email],
            [
                'name'          => $name,
                'password'      => Hash::make(self::PASSWORD),
                'is_zopa_staff' => $isZopaStaff,
                'is_active'     => true,
            ]
        );
    }

    private function assign(User $user, Tenant $tenant, string $role, User $by): void
    {
        UserTenantRole::firstOrCreate(
            ['user_id' => $user->id, 'tenant_id' => $tenant->id, 'role' => $role],
            ['assigned_by' => $by->id, 'is_active' => true]
        );
    }

    private function masterData(Tenant $tenant): void
    {
        $dept = Department::firstOrCreate(['tenant_id' => $tenant->id, 'name' => 'Procurement Dept']);
        $proj = Project::firstOrCreate(['tenant_id' => $tenant->id, 'name' => 'General Project']);
        $loc  = Location::firstOrCreate(['tenant_id' => $tenant->id, 'name' => 'Head Office']);

        CostCenter::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Default Cost Center'],
            [
                'department_id' => $dept->id, 'project_id' => $proj->id, 'location_id' => $loc->id,
                'annual_budget' => 1000000, 'current_fiscal_year' => (int) date('Y'), 'is_active' => true,
            ]
        );

        $cat = Category::firstOrCreate(['tenant_id' => $tenant->id, 'name' => 'General']);

        Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Sample Product'],
            ['category_id' => $cat->id, 'unit' => 'Nos', 'net_rate' => 100, 'gst_rate' => 18, 'is_active' => true]
        );

        Vendor::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Sample Vendor'],
            ['is_active' => true]
        );
    }

    private function report(): void
    {
        $this->command->info('');
        $this->command->info('  ✓ Test data ready. All accounts use password: ' . self::PASSWORD);
        $this->command->table(
            ['Role', 'Email', 'Tenant'],
            [
                ['zopa_super_admin',   'superadmin@zopatest.com', 'ZOPA Internal'],
                ['zopa_buyer',         'zbuyer@zopatest.com',     'Acme'],
                ['zopa_approver_l1',   'zl1@zopatest.com',        'Acme'],
                ['zopa_approver_l2',   'zl2@zopatest.com',        'Acme'],
                ['zopa_approver_l3',   'zl3@zopatest.com',        'ZOPA Internal'],
                ['zopa_pr',            'zpr@zopatest.com',        'ZOPA Internal'],
                ['zopa_grn',           'zgrn@zopatest.com',       'ZOPA Internal'],
                ['client_admin',       'cadmin@acmetest.com',     'Acme'],
                ['client_buyer',       'cbuyer@acmetest.com',     'Acme'],
                ['client_approver_l1', 'cl1@acmetest.com',        'Acme'],
                ['client_approver_l2', 'cl2@acmetest.com',        'Acme'],
                ['client_approver_l3', 'cl3@acmetest.com',        'Acme'],
                ['client_pr',          'cpr@acmetest.com',        'Acme'],
                ['client_grn',         'cgrn@acmetest.com',       'Acme'],
                ['client_admin',       'admin@globextest.com',    'Globex (isolation)'],
            ]
        );
    }
}
