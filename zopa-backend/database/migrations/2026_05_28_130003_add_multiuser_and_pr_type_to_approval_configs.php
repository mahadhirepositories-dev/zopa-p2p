<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Extend type ENUM to include 'pr' + add user_ids JSON column for multi-user parallel approvals
        DB::statement("
            ALTER TABLE approval_configs
              MODIFY COLUMN `type` ENUM('po','invoice','pr') NOT NULL DEFAULT 'po',
              ADD COLUMN `user_ids` JSON NULL AFTER `user_id`
        ");

        // 2. Add 'superseded' action to approvals table (first-responder wins pattern)
        DB::statement("
            ALTER TABLE approvals
              MODIFY COLUMN `action` ENUM('pending','approved','returned','rejected','superseded')
                NOT NULL DEFAULT 'pending'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE approval_configs
              MODIFY COLUMN `type` ENUM('po','invoice') NOT NULL DEFAULT 'po'
        ");
        DB::statement("ALTER TABLE approval_configs DROP COLUMN IF EXISTS `user_ids`");

        DB::statement("
            ALTER TABLE approvals
              MODIFY COLUMN `action` ENUM('pending','approved','returned','rejected')
                NOT NULL DEFAULT 'pending'
        ");
    }
};
