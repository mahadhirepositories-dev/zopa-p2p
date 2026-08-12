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
        // 1. Deduplicate existing products across all tenants
        $tenants = DB::table('products')->select('tenant_id')->distinct()->pluck('tenant_id');

        foreach ($tenants as $tenantId) {
            $products = DB::table('products')->where('tenant_id', $tenantId)->get();

            // Group products by code (when non-empty)
            $groupedByCode = $products->filter(fn($p) => !empty(trim((string)$p->code)))->groupBy(fn($p) => strtolower(trim($p->code)));

            foreach ($groupedByCode as $code => $items) {
                if ($items->count() > 1) {
                    $this->mergeProductGroup($items);
                }
            }

            // Also check for duplicate names where code might be empty or identical
            $remainingProducts = DB::table('products')->where('tenant_id', $tenantId)->get();
            $groupedByName = $remainingProducts->groupBy(fn($p) => strtolower(trim($p->name)));

            foreach ($groupedByName as $name => $items) {
                if ($items->count() > 1) {
                    $this->mergeProductGroup($items);
                }
            }
        }

        // 2. Add unique composite index on (tenant_id, code)
        try {
            Schema::table('products', function (Blueprint $table) {
                $table->unique(['tenant_id', 'code'], 'products_tenant_id_code_unique');
            });
        } catch (\Throwable $e) {
            // Index already exists or duplicate cleared — safely ignore
        }
    }

    private function mergeProductGroup($items): void
    {
        $itemIds = $items->pluck('id')->toArray();

        // Check which items are referenced in pr_items or po_items
        $prUsage = DB::table('pr_items')->whereIn('product_id', $itemIds)->pluck('product_id')->toArray();
        $poUsage = DB::table('po_items')->whereIn('product_id', $itemIds)->pluck('product_id')->toArray();

        $usedIds = array_values(array_unique(array_merge($prUsage, $poUsage)));

        // Primary product is either the first used item or the earliest created item
        if (!empty($usedIds)) {
            $primaryId = $usedIds[0];
        } else {
            $primaryId = $items->sortBy('id')->first()->id;
        }

        $duplicateIds = array_values(array_diff($itemIds, [$primaryId]));

        if (empty($duplicateIds)) {
            return;
        }

        // Re-link any PR items or PO items from duplicate IDs to primary ID
        DB::table('pr_items')->whereIn('product_id', $duplicateIds)->update(['product_id' => $primaryId]);
        DB::table('po_items')->whereIn('product_id', $duplicateIds)->update(['product_id' => $primaryId]);

        // Delete duplicate products
        DB::table('products')->whereIn('id', $duplicateIds)->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        try {
            Schema::table('products', function (Blueprint $table) {
                $table->dropUnique('products_tenant_id_code_unique');
            });
        } catch (\Throwable $e) {
            // Ignore if index missing
        }
    }
};
