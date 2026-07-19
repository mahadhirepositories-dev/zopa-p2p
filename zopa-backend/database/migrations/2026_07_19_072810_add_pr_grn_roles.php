<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE `user_tenant_roles` MODIFY COLUMN `role` ENUM(
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
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverting an enum requires dropping the new values first, which is destructive
        // and complicated if records exist. We'll leave it as is for down().
    }
};
