<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseOrder;
use App\Models\PoItem;
use App\Models\PrItem;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Fix PR23 Line 8: "Chairs (for community)" not matching "Plastic Chair" in PO 55 (TH/2026-27/55).
     * Also fix any other similar alias mismatches by matching via product_code (TH373, etc.)
     * Then re-run a full syncPrConversion across all PRs.
     */
    public function up(): void
    {
        // PR23: Match "Chairs (for community)" PR item to "Plastic Chair" PO item via product code TH373
        $pr23 = PurchaseRequisition::where('pr_number', 'PR23')
            ->orWhere('pr_number', 'PR-23')
            ->first();

        $po55 = PurchaseOrder::where('po_number', 'like', '%/55')
            ->orWhere('po_number', 'like', '%-55')
            ->orWhere('id', 55)
            ->first();

        if ($pr23 && $po55) {
            // Find "Plastic Chair" PO item (TH373) in PO55
            $plasticChairPo = $po55->items()
                ->where(function ($q) {
                    $q->where('description', 'like', '%Plastic Chair%')
                      ->orWhereHas('product', fn($p) => $p->where('code', 'TH373'));
                })->first();

            // Find "Chairs (for community)" in PR23 line items
            $chairsPrItem = $pr23->items()
                ->where(function ($q) {
                    $q->where('description', 'like', '%Chair%')
                      ->where('description', 'like', '%communit%');
                })->orWhere(function($q) {
                    // Also try matching by product code TH373
                    $q->whereHas('product', fn($p) => $p->where('code', 'TH373'));
                })->first();

            if ($plasticChairPo && $chairsPrItem) {
                $plasticChairPo->update(['pr_item_id' => $chairsPrItem->id]);
                \Log::info("PR23 fix: Linked PO55 'Plastic Chair' (po_item #{$plasticChairPo->id}) to PR23 'Chairs (for community)' (pr_item #{$chairsPrItem->id})");
            } else {
                // Fallback: match by sno (if same line number)
                $pr23->items->each(function ($prIt) use ($po55) {
                    $poIt = $po55->items()->where('sno', $prIt->sno)->first();
                    if ($poIt && $poIt->pr_item_id !== $prIt->id) {
                        $poIt->update(['pr_item_id' => $prIt->id]);
                    }
                });
            }

            PurchaseRequisition::syncPrConversion($pr23);
        }

        // Full re-sync for all PRs to catch any remaining mismatches
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $pr) {
            PurchaseRequisition::syncPrConversion($pr);
        }
    }

    public function down(): void {}
};
