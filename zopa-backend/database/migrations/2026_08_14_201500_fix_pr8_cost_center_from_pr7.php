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
        // 1. Find PR7 to copy its exact cost_center_id and location_id
        $pr7 = DB::table('purchase_requisitions')
            ->where('pr_number', 'PR7')
            ->orWhere('pr_ref', 'PR7')
            ->first();

        // 2. Find PR8 (by number or title)
        $pr8 = DB::table('purchase_requisitions')
            ->where('pr_number', 'PR8')
            ->orWhere('title', 'like', '%Report Cards%')
            ->first();

        if ($pr8 && $pr7) {
            // Update PR8 cost center and location to match PR7
            DB::table('purchase_requisitions')
                ->where('id', $pr8->id)
                ->update([
                    'cost_center_id' => $pr7->cost_center_id,
                    'location_id'    => $pr7->location_id,
                    'tenant_id'      => $pr7->tenant_id,
                ]);

            // Update any linked POs
            DB::table('purchase_orders')
                ->where('pr_id', $pr8->id)
                ->update([
                    'cost_center_id' => $pr7->cost_center_id,
                    'tenant_id'      => $pr7->tenant_id,
                ]);
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
