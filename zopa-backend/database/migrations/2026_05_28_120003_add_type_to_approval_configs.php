<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Single atomic ALTER TABLE:
        // 1. Add the type column (default 'po' so existing rows get po)
        // 2. Drop the old unique (cost_center_id, level)
        // 3. Add new unique (cost_center_id, type, level) — which also serves as FK-supporting index
        DB::statement("
            ALTER TABLE approval_configs
              ADD COLUMN `type` ENUM('po','invoice') NOT NULL DEFAULT 'po' AFTER `cost_center_id`,
              DROP INDEX `approval_configs_cost_center_id_level_unique`,
              ADD UNIQUE KEY `approval_configs_cc_type_level_unique` (`cost_center_id`,`type`,`level`)
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE approval_configs
              DROP INDEX `approval_configs_cc_type_level_unique`,
              ADD UNIQUE KEY `approval_configs_cost_center_id_level_unique` (`cost_center_id`,`level`),
              DROP COLUMN `type`
        ");
    }
};
