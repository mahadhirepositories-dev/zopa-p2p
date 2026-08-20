<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseOrder;
use App\Models\PoItem;
use App\Models\PrItem;

return new class extends Migration
{
    /**
     * Fix PR23: "Chairs (for community)" PR item not matching "Plastic Chair" in linked POs.
     * Strategy: For each PR that has "partially_converted" status, try sno-based 1-to-1 linking
     * for any of its linked POs where the item count matches. Then re-run full syncPrConversion.
     */
    public function up(): void
    {
        // Step 1: Find all partially converted PRs and try sno-based 1-to-1 re-linking
        $partialPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])
            ->whereIn('status', ['partially_converted', 'submitted', 'approved'])
            ->get();

        foreach ($partialPrs as $pr) {
            $allPos = $pr->purchaseOrders->concat($pr->linkedPurchaseOrders)->unique('id');

            // For each linked PO, if PO item count matches PR item count, do 1-to-1 sno linking
            foreach ($allPos as $po) {
                if ($po->items->count() === $pr->items->count()) {
                    foreach ($po->items as $poIt) {
                        $matchingPr = $pr->items->firstWhere('sno', $poIt->sno);
                        if ($matchingPr && $poIt->pr_item_id !== $matchingPr->id) {
                            $poIt->update(['pr_item_id' => $matchingPr->id]);
                        }
                    }
                }
            }

            // Also try: for each unlinked PO item, match by sno to PR item if unlinked
            foreach ($allPos as $po) {
                foreach ($po->items as $poIt) {
                    if (empty($poIt->pr_item_id)) {
                        $matchingPr = $pr->items->firstWhere('sno', $poIt->sno);
                        if ($matchingPr) {
                            $poIt->update(['pr_item_id' => $matchingPr->id]);
                        }
                    }
                }
            }

            // Re-sync conversion for this PR
            PurchaseRequisition::syncPrConversion($pr);
        }

        // Step 2: Full resync for all PRs
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $pr) {
            PurchaseRequisition::syncPrConversion($pr);
        }
    }

    public function down(): void {}
};
