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
        // 1. Find cost center named 'Apollo Isha Vidhya Niketan' or 'Apollo Isha Vidhya Nikethan'
        $costCenter = DB::table('cost_centers')
            ->where('name', 'like', '%Isha%')
            ->orWhere('name', 'like', '%Vidhya%')
            ->orWhere('name', 'like', '%Niketan%')
            ->orWhere('name', 'like', '%Nikethan%')
            ->first();

        // 2. Find location named 'Apollo Isha Vidhya Niketan' or 'Apollo Isha Vidhya Nikethan'
        $location = DB::table('locations')
            ->where('name', 'like', '%Isha%')
            ->orWhere('name', 'like', '%Vidhya%')
            ->orWhere('name', 'like', '%Niketan%')
            ->orWhere('name', 'like', '%Nikethan%')
            ->first();

        // 3. Fallback to PR7 (ID 71 or pr_number PR7) if needed
        $pr7 = DB::table('purchase_requisitions')->where('id', 71)->first()
            ?? DB::table('purchase_requisitions')->where('pr_number', 'PR7')->first();

        $targetCostCenterId = $costCenter?->id ?? $pr7?->cost_center_id;
        $targetLocationId   = $location?->id ?? $pr7?->location_id;
        $targetTenantId     = $pr7?->tenant_id;

        if ($targetCostCenterId) {
            $updateData = ['cost_center_id' => $targetCostCenterId];
            if ($targetLocationId) {
                $updateData['location_id'] = $targetLocationId;
            }

            DB::table('purchase_requisitions')
                ->where('id', 72)
                ->update($updateData);

            // Also update any linked POs
            DB::table('purchase_orders')
                ->where('pr_id', 72)
                ->update([
                    'cost_center_id' => $targetCostCenterId,
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
