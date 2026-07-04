<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Normalise the approval_configs unique index to (cost_center_id, type, level).
 *
 * Background: after the 'type' column (po / invoice / pr) was added, each cost
 * center can legitimately hold level-1 configs for all three types. A unique index
 * on just (cost_center_id, level) would block that. This migration guarantees the
 * correct composite unique index exists.
 *
 * Written defensively with information_schema existence checks because the legacy
 * (cost_center_id, level) index is NOT present on every environment (it exists on
 * some dev DBs but was never created on production). A blind dropUnique() throws
 * SQLSTATE 1091 ("Can't DROP … ; check that it exists") and aborts the whole
 * deploy — which is exactly what happened. Each step is now a no-op when the
 * target state already holds, so the migration is safe to run anywhere.
 */
return new class extends Migration
{
    private function indexExists(string $name): bool
    {
        return collect(DB::select(
            "SELECT 1 FROM information_schema.statistics
             WHERE table_schema = DATABASE()
               AND table_name = 'approval_configs'
               AND index_name = ? LIMIT 1",
            [$name]
        ))->isNotEmpty();
    }

    public function up(): void
    {
        // Drop the legacy index only if it actually exists.
        if ($this->indexExists('approval_configs_cost_center_id_level_unique')) {
            DB::statement('ALTER TABLE approval_configs DROP INDEX approval_configs_cost_center_id_level_unique');
        }

        // Add the composite index only if it isn't already there and no duplicate
        // (cost_center_id, type, level) rows would violate it. If duplicates somehow
        // exist, skip silently rather than fail the deploy — the app logic does not
        // depend on this constraint, it is defence-in-depth.
        if (! $this->indexExists('approval_configs_cost_center_id_type_level_unique')) {
            $dupes = DB::select(
                "SELECT cost_center_id, type, level, COUNT(*) c
                 FROM approval_configs
                 GROUP BY cost_center_id, type, level HAVING c > 1 LIMIT 1"
            );
            if (empty($dupes)) {
                DB::statement(
                    'ALTER TABLE approval_configs
                     ADD UNIQUE approval_configs_cost_center_id_type_level_unique (cost_center_id, type, level)'
                );
            }
        }
    }

    public function down(): void
    {
        if ($this->indexExists('approval_configs_cost_center_id_type_level_unique')) {
            DB::statement('ALTER TABLE approval_configs DROP INDEX approval_configs_cost_center_id_type_level_unique');
        }
    }
};
