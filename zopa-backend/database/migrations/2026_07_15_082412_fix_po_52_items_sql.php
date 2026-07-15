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
        // Fix for item 44
        \Illuminate\Support\Facades\DB::statement("UPDATE po_items SET description = 'Piroxicam Inj', product_name = 'Piroxicam Inj' WHERE sno = 44 AND po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE '%52%')");
        \Illuminate\Support\Facades\DB::statement("UPDATE pr_items SET description = 'Piroxicam Inj' WHERE id IN (SELECT pr_item_id FROM po_items WHERE sno = 44 AND po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE '%52%'))");

        // Fix for item 76
        \Illuminate\Support\Facades\DB::statement("UPDATE po_items SET description = 'Disposable syringe (medical device) - 10 ml', product_name = 'Disposable syringe (medical device) - 10 ml' WHERE sno = 76 AND po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE '%52%')");
        \Illuminate\Support\Facades\DB::statement("UPDATE pr_items SET description = 'Disposable syringe (medical device) - 10 ml' WHERE id IN (SELECT pr_item_id FROM po_items WHERE sno = 76 AND po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE '%52%'))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
