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
        $po = \App\Models\PurchaseOrder::where('po_number', 'like', '%/52')->first();
        if ($po) {
            // line item 44
            $item44 = \App\Models\PoItem::where('po_id', $po->id)->where('sno', 44)->first();
            if ($item44) {
                $item44->product_name = str_ireplace('Piroxicam', 'Piroxicam Inj', $item44->product_name ?? '');
                $item44->description = str_ireplace('Piroxicam', 'Piroxicam Inj', $item44->description ?? '');
                
                $item44->product_name = str_ireplace('Piroxicam Inj Inj', 'Piroxicam Inj', $item44->product_name);
                $item44->description = str_ireplace('Piroxicam Inj Inj', 'Piroxicam Inj', $item44->description);
                $item44->save();

                if ($item44->pr_item_id) {
                    $prItem = \App\Models\PrItem::find($item44->pr_item_id);
                    if ($prItem) {
                        $prItem->description = str_ireplace('Piroxicam', 'Piroxicam Inj', $prItem->description ?? '');
                        $prItem->description = str_ireplace('Piroxicam Inj Inj', 'Piroxicam Inj', $prItem->description);
                        $prItem->save();
                    }
                }
            }

            // line item 76
            $item76 = \App\Models\PoItem::where('po_id', $po->id)->where('sno', 76)->first();
            if ($item76) {
                $item76->product_name = str_ireplace('- 3 ml', '- 10 ml', $item76->product_name ?? '');
                $item76->description = str_ireplace('- 3 ml', '- 10 ml', $item76->description ?? '');
                $item76->save();

                if ($item76->pr_item_id) {
                    $prItem = \App\Models\PrItem::find($item76->pr_item_id);
                    if ($prItem) {
                        $prItem->description = str_ireplace('- 3 ml', '- 10 ml', $prItem->description ?? '');
                        $prItem->save();
                    }
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // One-way migration
    }
};
