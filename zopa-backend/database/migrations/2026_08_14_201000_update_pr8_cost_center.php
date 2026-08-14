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
        // 1. Find Apollo Isha Vidhya Niketan cost center
        $costCenter = DB::table('cost_centers')
            ->where('name', 'like', '%Isha%')
            ->orWhere('name', 'like', '%Vidhya%')
            ->orWhere('name', 'like', '%Niketan%')
            ->orWhere('name', 'like', '%Nikethan%')
            ->first();

        if (!$costCenter) {
            return;
        }

        // 2. Find PR8
        $pr = DB::table('purchase_requisitions')
            ->where('pr_number', 'PR8')
            ->orWhere('pr_ref', 'PR8')
            ->first();

        if ($pr) {
            // Update cost_center_id on purchase_requisitions
            DB::table('purchase_requisitions')
                ->where('id', $pr->id)
                ->update(['cost_center_id' => $costCenter->id]);

            // Update cost_center_id on any linked purchase_orders
            DB::table('purchase_orders')
                ->where('pr_id', $pr->id)
                ->update(['cost_center_id' => $costCenter->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op for data patch
    }
};
