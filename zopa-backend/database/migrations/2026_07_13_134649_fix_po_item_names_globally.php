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

        // Update all PO items globally
        \App\Models\PoItem::chunk(200, function ($poItems) use ($replacements) {
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
                }
            }
        });

        // Update all PR items globally
        \App\Models\PrItem::chunk(200, function ($prItems) use ($replacements) {
            foreach ($prItems as $prItem) {
                $prDesc = $prItem->description;
                foreach ($replacements as $wrong => $right) {
                    $prDesc = str_ireplace($wrong, $right, $prDesc ?? '');
                }
                if ($prDesc !== $prItem->description) {
                    $prItem->description = $prDesc;
                    $prItem->save();
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // One-way migration
    }
};
