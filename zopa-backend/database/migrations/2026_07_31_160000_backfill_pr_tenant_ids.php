<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Backfill purchase_requisitions.tenant_id from cost_centers.tenant_id
        DB::statement("
            UPDATE purchase_requisitions pr
            JOIN cost_centers cc ON pr.cost_center_id = cc.id
            SET pr.tenant_id = cc.tenant_id
            WHERE pr.tenant_id IS NULL AND cc.tenant_id IS NOT NULL
        ");

        // 2. If any PR still has NULL tenant_id, default to the first tenant (e.g. Total Health or ZOPA)
        $firstTenantId = DB::table('tenants')->orderBy('id')->value('id');
        if ($firstTenantId) {
            DB::statement("
                UPDATE purchase_requisitions
                SET tenant_id = {$firstTenantId}
                WHERE tenant_id IS NULL
            ");
        }
    }

    public function down(): void
    {
        // No-op
    }
};
