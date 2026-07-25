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
        // 1. Update PO-81 line items (or PO ID 40 / PO-81)
        $po81Ids = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'LIKE', '%81')
                  ->orWhere('po_number', 'LIKE', '%81%')
                  ->orWhere('id', 40);
            })
            ->pluck('id');

        foreach ($po81Ids as $poId) {
            // Line item 1: LENOVO K9 tablet description
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 1)
                      ->orWhere('product_code', 'TH383')
                      ->orWhere('description', 'LIKE', '%Tablet%');
                })
                ->update([
                    'description' => 'LENOVO K9 (8.7") Only WI-FI no sim provision. MediaTek Helio G85; Octa-Core WiFi Only 4GBRAM/ 64GB/ HD 8.7 Inch/ 8MP 2MP 5100 mAh Android 14'
                ]);

            // Line item 2: Logitech Web Camera C270 description
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 2)
                      ->orWhere('product_code', 'TH386')
                      ->orWhere('description', 'LIKE', '%Webcam%');
                })
                ->update([
                    'description' => 'Logitech Web Camera Model : C270'
                ]);
        }

        // 2. Update PO-80 line items
        $po80Ids = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'LIKE', '%80')
                  ->orWhere('po_number', 'LIKE', '%80%');
            })
            ->pluck('id');

        foreach ($po80Ids as $poId) {
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 1)
                      ->orWhere('description', 'LIKE', '%fire%')
                      ->orWhere('description', 'LIKE', '%extinguisher%')
                      ->orWhere('description', 'LIKE', '%Abc%');
                })
                ->update([
                    'description' => 'Abc 2 kg fire extinguisher'
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive down method
    }
};
