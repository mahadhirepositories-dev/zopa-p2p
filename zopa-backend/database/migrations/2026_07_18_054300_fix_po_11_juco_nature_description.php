<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Fix Line Item #1 for PO 11 description
        DB::statement("
            UPDATE po_items 
            SET 
                product_name = 'JUCO NATURE 60\" (Oxford Jute Fabric)',
                description = 'JUCO NATURE 60\" (Oxford Jute Fabric)'
            WHERE sno = 1 
            AND po_id = 11
        ");
        
        DB::statement("
            UPDATE pr_items 
            SET description = 'JUCO NATURE 60\" (Oxford Jute Fabric)'
            WHERE id IN (
                SELECT pr_item_id FROM po_items 
                WHERE sno = 1 AND po_id = 11
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
