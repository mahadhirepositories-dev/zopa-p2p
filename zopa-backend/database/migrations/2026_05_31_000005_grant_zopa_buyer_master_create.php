<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Grants ZOPA buyers create/edit on master data so ZOPA staff can set up a
 * client's vendors, products, cost centers and org masters on their behalf
 * (without the client having to log in). Applies to the already-seeded
 * production matrix; new installs get this from RolePermissionSeeder.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!DB::getSchemaBuilder()->hasTable('role_permissions')) {
            return;
        }

        DB::table('role_permissions')
            ->where('role', 'zopa_buyer')
            ->whereIn('module', ['products', 'cost_centers', 'org_masters', 'vendors'])
            ->update(['can_create' => true, 'can_edit' => true, 'updated_at' => now()]);

        // Clear the permission cache so the change is picked up immediately.
        Cache::flush();
    }

    public function down(): void
    {
        if (!DB::getSchemaBuilder()->hasTable('role_permissions')) {
            return;
        }

        DB::table('role_permissions')
            ->where('role', 'zopa_buyer')
            ->whereIn('module', ['products', 'cost_centers', 'org_masters'])
            ->update(['can_create' => false, 'can_edit' => false, 'updated_at' => now()]);
    }
};
