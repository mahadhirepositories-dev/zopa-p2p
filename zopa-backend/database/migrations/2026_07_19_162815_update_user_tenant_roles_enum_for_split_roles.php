<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Delete old combined roles from existing tables to avoid enum constraint errors
        \Illuminate\Support\Facades\DB::table('role_permissions')
            ->whereIn('role', ['zopa_pr_grn', 'client_pr_grn'])
            ->delete();
            
        \Illuminate\Support\Facades\DB::table('user_tenant_roles')
            ->whereIn('role', ['zopa_pr_grn', 'client_pr_grn'])
            ->delete();

        // 2. Update the ENUM definition to include the separated roles
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE `user_tenant_roles` MODIFY COLUMN `role` ENUM(
            'zopa_super_admin',
            'zopa_buyer',
            'zopa_approver_l1',
            'zopa_approver_l2',
            'zopa_approver_l3',
            'zopa_pr',
            'zopa_grn',
            'client_admin',
            'client_buyer',
            'client_approver_l1',
            'client_approver_l2',
            'client_approver_l3',
            'client_pr',
            'client_grn'
        ) NOT NULL");

        // 3. Automatically run the RolePermissionSeeder to seed the new permissions for all roles
        \Illuminate\Support\Facades\Artisan::call('db:seed', [
            '--class' => 'RolePermissionSeeder',
            '--force' => true
        ]);
        
        \Illuminate\Support\Facades\Artisan::call('cache:clear');
    }

    public function down(): void
    {
        // Not easily reversible due to data loss on deleted roles
    }
};
