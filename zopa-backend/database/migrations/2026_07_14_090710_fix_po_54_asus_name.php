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
        $replaceWrong = 'Asus Core i7 Vivo book';
        $replaceRight = 'Asus Core i7 Vivo book 16';

        // Update all PO items globally
        \App\Models\PoItem::chunk(200, function ($poItems) use ($replaceWrong, $replaceRight) {
            foreach ($poItems as $item) {
                $productName = $item->product_name;
                $description = $item->description;

                $productName = str_ireplace($replaceWrong, $replaceRight, $productName ?? '');
                // Prevent double '16 16' if it was already correct
                $productName = str_ireplace('Asus Core i7 Vivo book 16 16', 'Asus Core i7 Vivo book 16', $productName);

                $description = str_ireplace($replaceWrong, $replaceRight, $description ?? '');
                $description = str_ireplace('Asus Core i7 Vivo book 16 16', 'Asus Core i7 Vivo book 16', $description);

                if ($productName !== $item->product_name || $description !== $item->description) {
                    $item->product_name = $productName;
                    $item->description  = $description;
                    $item->save();
                }
            }
        });

        // Update all PR items globally
        \App\Models\PrItem::chunk(200, function ($prItems) use ($replaceWrong, $replaceRight) {
            foreach ($prItems as $prItem) {
                $prDesc = $prItem->description;
                $prDesc = str_ireplace($replaceWrong, $replaceRight, $prDesc ?? '');
                $prDesc = str_ireplace('Asus Core i7 Vivo book 16 16', 'Asus Core i7 Vivo book 16', $prDesc);

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
