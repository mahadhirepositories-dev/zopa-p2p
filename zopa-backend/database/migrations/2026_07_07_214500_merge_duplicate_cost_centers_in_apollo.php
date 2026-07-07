<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $apollo = DB::table('tenants')->where('name', 'Apollo Isha Vidhya Niketan')->first();

        if (!$apollo) {
            return;
        }

        // Find cost centers with this name in Apollo
        $costCenters = DB::table('cost_centers')
            ->where('tenant_id', $apollo->id)
            ->where('name', 'Apollo Isha Vidhya Niketan')
            ->orderBy('id', 'asc')
            ->get();

        if ($costCenters->count() > 1) {
            // Keep the first one
            $primary = $costCenters->first();
            $duplicates = $costCenters->slice(1);

            foreach ($duplicates as $duplicate) {
                // Update PRs
                DB::table('purchase_requisitions')
                    ->where('cost_center_id', $duplicate->id)
                    ->update(['cost_center_id' => $primary->id]);

                // Update POs
                DB::table('purchase_orders')
                    ->where('cost_center_id', $duplicate->id)
                    ->update(['cost_center_id' => $primary->id]);

                // Delete related budget ledger and approval configs of the duplicate to avoid unique constraint violations
                DB::table('budget_ledger')->where('cost_center_id', $duplicate->id)->delete();
                DB::table('approval_configs')->where('cost_center_id', $duplicate->id)->delete();

                // Delete the duplicate cost center
                DB::table('cost_centers')->where('id', $duplicate->id)->delete();
            }
        }
    }

    public function down(): void
    {
        //
    }
};
