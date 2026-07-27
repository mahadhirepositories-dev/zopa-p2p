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
        // Restore PO 83 back to original PO 73 number in Total Health tenant
        DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/83')
                  ->orWhere('po_number', 'TH2026-27/83')
                  ->orWhere('po_number', 'LIKE', '%83');
            })
            ->where(function ($q) {
                $q->where('grand_total', 823541)
                  ->orWhere('grand_total', 823541.00)
                  ->orWhere('po_number', 'TH/2026-27/83');
            })
            ->update([
                'po_number' => 'TH/2026-27/73'
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive down method
    }
};
