<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The original approval_configs unique index covers (cost_center_id, level) but NOT
 * type. Once the 'type' column was added (po / invoice / pr), each cost center can
 * legitimately have level-1 configs for all three types. The old index prevents this:
 * saving a PO L1 config after an invoice L1 config (or vice-versa) throws a duplicate-
 * key violation, leaving the second save silently failed — causing POs to auto-approve
 * because no PO config is found for the cost center.
 *
 * Fix: drop the old (cost_center_id, level) index and replace it with
 * (cost_center_id, type, level) — each (center, type, level) triple is unique.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_configs', function (Blueprint $table) {
            $table->dropUnique(['cost_center_id', 'level']);
            $table->unique(['cost_center_id', 'type', 'level']);
        });
    }

    public function down(): void
    {
        Schema::table('approval_configs', function (Blueprint $table) {
            $table->dropUnique(['cost_center_id', 'type', 'level']);
            $table->unique(['cost_center_id', 'level']);
        });
    }
};
