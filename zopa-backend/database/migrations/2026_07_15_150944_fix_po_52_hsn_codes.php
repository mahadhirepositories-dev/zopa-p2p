<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Fix HSN codes for PO 52
        \Illuminate\Support\Facades\DB::statement("
            UPDATE po_items
            JOIN products ON po_items.product_id = products.id
            SET po_items.hsn_code = products.hsn_code
            WHERE po_items.po_id IN (
                SELECT id FROM purchase_orders WHERE po_number LIKE '%52%'
            )
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
