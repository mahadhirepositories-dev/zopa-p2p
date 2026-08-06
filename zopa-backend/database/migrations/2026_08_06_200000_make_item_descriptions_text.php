<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

/**
 * 1. Changes `po_items.description`, `pr_items.description`, and `po_items.product_name`
 *    column types to TEXT to support long specifications without truncation errors.
 * 2. Grants `zopa_buyer` and `client_buyer` create & edit permissions on master data modules
 *    (products, vendors, cost_centers, org_masters) so buyers can add products seamlessly.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE po_items MODIFY COLUMN description TEXT NOT NULL");
        DB::statement("ALTER TABLE pr_items MODIFY COLUMN description TEXT NOT NULL");
        DB::statement("ALTER TABLE po_items MODIFY COLUMN product_name TEXT NULL");

        if (DB::getSchemaBuilder()->hasTable('role_permissions')) {
            DB::table('role_permissions')
                ->whereIn('role', ['zopa_buyer', 'client_buyer'])
                ->whereIn('module', ['products', 'cost_centers', 'org_masters', 'vendors'])
                ->update([
                    'can_create' => true,
                    'can_edit'   => true,
                    'updated_at' => now(),
                ]);

            Cache::flush();
        }
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE po_items MODIFY COLUMN description VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE pr_items MODIFY COLUMN description VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE po_items MODIFY COLUMN product_name VARCHAR(255) NULL");
    }
};
