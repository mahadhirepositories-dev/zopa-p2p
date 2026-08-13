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
        $po = DB::table('purchase_orders')->where('po_number', 'TH/2026-27/103')->first();
        if ($po) {
            // Update PO header warranty to 36 months (3 years)
            DB::table('purchase_orders')->where('id', $po->id)->update([
                'warranty_months' => 36,
            ]);

            // Update PO line items warranty to 36 months (3 years)
            DB::table('po_items')->where('po_id', $po->id)->update([
                'warranty_months' => 36,
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
