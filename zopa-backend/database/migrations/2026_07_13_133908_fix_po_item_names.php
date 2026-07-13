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
        $replacements = [
            'PotasiumClavulanate' => 'Potassium clavulanate',
            'Salbulamol'          => 'Salbutamol',
            'Methol'              => 'Menthol',
            'Craem'               => 'Cream',
            'Naproxacin'          => 'Naproxen',
            'Rantidine'           => 'Ranitidine',
            'Piroxin'             => 'Piroxicam',
            'Dextrox'             => 'Dextrose',
        ];

        // Update PO items for PO 52 and 53
        $poItems = \App\Models\PoItem::whereIn('po_id', [52, 53])->get();
        foreach ($poItems as $item) {
            $productName = $item->product_name;
            $description = $item->description;

            foreach ($replacements as $wrong => $right) {
                $productName = str_ireplace($wrong, $right, $productName ?? '');
                $description = str_ireplace($wrong, $right, $description ?? '');
            }

            if ($productName !== $item->product_name || $description !== $item->description) {
                $item->product_name = $productName;
                $item->description  = $description;
                $item->save();

                // Update corresponding PR item if it exists
                if ($item->pr_item_id) {
                    $prItem = \App\Models\PrItem::find($item->pr_item_id);
                    if ($prItem) {
                        $prDesc = $prItem->description;
                        foreach ($replacements as $wrong => $right) {
                            $prDesc = str_ireplace($wrong, $right, $prDesc ?? '');
                        }
                        if ($prDesc !== $prItem->description) {
                            $prItem->description = $prDesc;
                            $prItem->save();
                        }
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
