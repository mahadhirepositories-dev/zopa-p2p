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
        // Fix Line 68 (Sanitizer) HSN Code to 3808
        \Illuminate\Support\Facades\DB::statement("
            UPDATE po_items 
            SET hsn_code = '3808' 
            WHERE sno = 68 
            AND po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE '%52%')
        ");

        // Fix Line 73 Cream -> Gel
        \Illuminate\Support\Facades\DB::statement("
            UPDATE po_items 
            SET 
                product_name = REPLACE(product_name, 'Cream', 'Gel'),
                description = REPLACE(description, 'Cream', 'Gel')
            WHERE sno = 73 
            AND po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE '%52%')
        ");
        
        \Illuminate\Support\Facades\DB::statement("
            UPDATE pr_items 
            SET description = REPLACE(description, 'Cream', 'Gel')
            WHERE id IN (
                SELECT pr_item_id FROM po_items 
                WHERE sno = 73 AND po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE '%52%')
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
