<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Delete all draft PRs created on 2026-08-01 for Total Health or with title Laptops
        $tenantIds = DB::table('tenants')
            ->where('name', 'LIKE', '%TOTAL HEALTH%')
            ->orWhere('name', 'LIKE', '%Total Health%')
            ->orWhere('code', 'LIKE', '%TH%')
            ->pluck('id');

        if ($tenantIds->isNotEmpty()) {
            $prIds = DB::table('purchase_requisitions')
                ->whereIn('tenant_id', $tenantIds)
                ->where('status', 'draft')
                ->whereDate('created_at', '2026-08-01')
                ->pluck('id');

            DB::table('pr_items')->whereIn('pr_id', $prIds)->delete();
            DB::table('purchase_requisitions')->whereIn('id', $prIds)->delete();
        }

        // Also clean up any un-submitted draft PRs created on 2026-08-01 titled Laptops
        $laptopDraftPrIds = DB::table('purchase_requisitions')
            ->where('status', 'draft')
            ->where('title', 'LIKE', '%Laptop%')
            ->whereDate('created_at', '2026-08-01')
            ->pluck('id');

        if ($laptopDraftPrIds->isNotEmpty()) {
            DB::table('pr_items')->whereIn('pr_id', $laptopDraftPrIds)->delete();
            DB::table('purchase_requisitions')->whereIn('id', $laptopDraftPrIds)->delete();
        }
    }

    public function down(): void
    {
    }
};
