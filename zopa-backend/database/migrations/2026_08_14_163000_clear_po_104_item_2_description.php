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
        $po = DB::table('purchase_orders')->where('po_number', 'TH/2026-27/104')->first()
           ?? DB::table('purchase_orders')->where('id', 89)->first();

        if ($po) {
            DB::table('po_items')
                ->where('po_id', $po->id)
                ->where('sno', 2)
                ->update(['description' => '']);
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
