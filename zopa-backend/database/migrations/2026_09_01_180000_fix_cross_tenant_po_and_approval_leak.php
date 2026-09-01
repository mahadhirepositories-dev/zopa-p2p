<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Fix any POs and PRs whose tenant_id is mismatched from their cost center's tenant_id,
     * specifically ensuring PO TH/2026-27/101 belongs to Total Health.
     */
    public function up(): void
    {
        // 1. Find Total Health tenant
        $totalHealthTenant = DB::table('tenants')
            ->where('name', 'LIKE', '%Total Health%')
            ->orWhere('code', 'LIKE', '%TH%')
            ->first();

        // 2. Fix PO TH/2026-27/101 specifically
        if ($totalHealthTenant) {
            DB::table('purchase_orders')
                ->where('po_number', 'LIKE', '%TH%101%')
                ->orWhere('po_number', 'TH/2026-27/101')
                ->update([
                    'tenant_id'  => $totalHealthTenant->id,
                    'updated_at' => now(),
                ]);
        }

        // 3. Fix any purchase_orders whose tenant_id doesn't match their cost center's tenant_id
        $mismatchedPos = DB::table('purchase_orders')
            ->join('cost_centers', 'cost_centers.id', '=', 'purchase_orders.cost_center_id')
            ->whereColumn('purchase_orders.tenant_id', '!=', 'cost_centers.tenant_id')
            ->select('purchase_orders.id as po_id', 'cost_centers.tenant_id as correct_tenant_id')
            ->get();

        foreach ($mismatchedPos as $row) {
            DB::table('purchase_orders')
                ->where('id', $row->po_id)
                ->update([
                    'tenant_id'  => $row->correct_tenant_id,
                    'updated_at' => now(),
                ]);
        }

        // 4. Fix any purchase_requisitions whose tenant_id doesn't match their cost center's tenant_id
        $mismatchedPrs = DB::table('purchase_requisitions')
            ->join('cost_centers', 'cost_centers.id', '=', 'purchase_requisitions.cost_center_id')
            ->whereColumn('purchase_requisitions.tenant_id', '!=', 'cost_centers.tenant_id')
            ->select('purchase_requisitions.id as pr_id', 'cost_centers.tenant_id as correct_tenant_id')
            ->get();

        foreach ($mismatchedPrs as $row) {
            DB::table('purchase_requisitions')
                ->where('id', $row->pr_id)
                ->update([
                    'tenant_id'  => $row->correct_tenant_id,
                    'updated_at' => now(),
                ]);
        }

        Cache::flush();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
