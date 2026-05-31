<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use App\Models\UserTenantRole;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Run a FULL RESET and create only the ZOPA super admin.
     * Usage: php artisan migrate:fresh --seed
     */
    public function run(): void
    {
        // ── Wipe all tenant/business data ──────────────────────────────
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        $tables = [
            'activity_logs', 'approvals', 'approval_configs',
            'po_attachments', 'po_items', 'purchase_orders',
            'pr_items', 'purchase_requisitions',
            'tat_records', 'budget_lines', 'grns', 'grn_items',
            'invoices', 'email_action_tokens',
            'cost_centers', 'departments', 'projects', 'locations',
            'vendor_addresses', 'vendors', 'products', 'categories',
            'user_tenant_roles', 'users', 'tenants',
        ];

        foreach ($tables as $table) {
            if (DB::getSchemaBuilder()->hasTable($table)) {
                DB::table($table)->truncate();
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        // ── ZOPA master tenant (internal) ─────────────────────────────
        $zopaTenant = Tenant::create([
            'name'               => 'ZOPA Internal',
            'code'               => 'ZOPA',
            'gstin'              => '',
            'po_prefix'          => 'PO',
            'fiscal_year_start'  => 4,
            'is_active'          => true,
            'is_internal'        => true,
            'plan'               => 'enterprise',
        ]);

        // ── ZOPA super admin ──────────────────────────────────────────
        $superAdmin = User::create([
            'name'          => 'Webmaster',
            'email'         => 'webmaster@zopapro.com',
            'password'      => Hash::make('ZOPA@123#'),
            'is_zopa_staff' => true,
            'is_active'     => true,
        ]);

        UserTenantRole::create([
            'user_id'     => $superAdmin->id,
            'tenant_id'   => $zopaTenant->id,
            'role'        => 'zopa_super_admin',
            'assigned_by' => $superAdmin->id,
            'is_active'   => true,
        ]);

        // Seed default role permissions (idempotent — uses insertOrIgnore)
        $this->call(RolePermissionSeeder::class);

        $this->command->info('✓ Fresh install complete.');
        $this->command->info('  Login: webmaster@zopapro.com / ZOPA@123#');
        $this->command->info('  You can now configure tenants and users from Client Management.');
    }
}
