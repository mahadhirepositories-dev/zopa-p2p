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
     * Fix PR23 (ID 35) and all PRs conversion linking:
     * 1. Match stem words (chair/chairs, table/tables, etc.)
     * 2. Direct linkage for PR23 / PR ID 35 "Chairs (for community)" -> "Plastic Chair"
     * 3. Sync all PR conversions.
     */
    public function up(): void
    {
        // 1. Direct fix for PR 35 / PR23
        $prs = PurchaseRequisition::where('id', 35)
            ->orWhere('pr_number', 'like', '%23%')
            ->orWhere('title', 'like', '%NCD%')
            ->get();

        foreach ($prs as $pr) {
            $chairPrItem = $pr->items()
                ->where(function ($q) {
                    $q->where('description', 'like', '%communit%')
                      ->orWhere('description', 'like', '%Plastic Chair%')
                      ->orWhere('sno', 8);
                })
                ->where('qty', '>=', 19.0)
                ->first();

            if ($chairPrItem) {
                // Find all linked PO items with qty 20 or description with chair/plastic
                $allPos = $pr->purchaseOrders->concat($pr->linkedPurchaseOrders)->unique('id');
                
                // Also search POs like TH/2026-27/55, 91, 92, 93
                $additionalPos = PurchaseOrder::whereIn('po_number', [
                    'TH/2026-27/55', 'TH/2026-27/91', 'TH/2026-27/92', 'TH/2026-27/93'
                ])->get();
                $allPos = $allPos->concat($additionalPos)->unique('id');

                foreach ($allPos as $po) {
                    // Ensure PO is attached to PR
                    $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po->id]);

                    foreach ($po->items as $poItem) {
                        $pDesc = strtolower($poItem->description ?? '');
                        if ((str_contains($pDesc, 'chair') || str_contains($pDesc, 'plastic')) && abs((float)$poItem->qty - 20.0) < 0.01) {
                            $poItem->update(['pr_item_id' => $chairPrItem->id]);
                            $chairPrItem->update(['converted_qty' => (float)$poItem->qty]);
                        }
                    }
                }
            }

            PurchaseRequisition::syncPrConversion($pr);
        }

        // 2. Also run syncPrConversion on every PR in the system
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $p) {
            PurchaseRequisition::syncPrConversion($p);
        }
    }

    public function down(): void {}
};
