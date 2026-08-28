<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Update TH527 product and PO/PR line item descriptions to 'Mefenamic Acid + Paracetamol Syrup' (Syrup not Tablet).
     */
    public function up(): void
    {
        // 1. Update products master table
        DB::table('products')
            ->where('code', 'TH527')
            ->orWhere(function ($q) {
                $q->where('name', 'LIKE', '%Mefenamic%')
                  ->where('name', 'LIKE', '%Paracetamol%')
                  ->where('name', 'LIKE', '%Tablet%');
            })
            ->update([
                'name'        => 'Mefenamic Acid + Paracetamol Syrup',
                'description' => 'Mefenamic Acid + Paracetamol Syrup',
                'updated_at'  => now(),
            ]);

        // 2. Update po_items table
        DB::table('po_items')
            ->where('product_code', 'TH527')
            ->orWhere(function ($q) {
                $q->where('description', 'LIKE', '%Mefenamic%')
                  ->where('description', 'LIKE', '%Paracetamol%');
            })
            ->update([
                'product_name' => 'Mefenamic Acid + Paracetamol Syrup',
                'description'  => 'Mefenamic Acid + Paracetamol Syrup',
                'updated_at'   => now(),
            ]);

        // 3. Update pr_items table
        DB::table('pr_items')
            ->where(function ($q) {
                $q->where('description', 'LIKE', '%Mefenamic%')
                  ->where('description', 'LIKE', '%Paracetamol%');
            })
            ->update([
                'description' => 'Mefenamic Acid + Paracetamol Syrup',
                'updated_at'  => now(),
            ]);

        Cache::flush();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
