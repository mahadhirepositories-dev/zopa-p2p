<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Resync all PRs using the updated precision-safe conversion resolution logic.
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $pr) {
            PurchaseRequisition::syncPrConversion($pr);
        }

        // 2. Explicitly inspect any PRs still marked 'converted' and demote those with unfulfilled items
        $convertedPrs = PurchaseRequisition::with('items')
            ->where('status', 'converted')
            ->get();

        foreach ($convertedPrs as $cPr) {
            $hasUnresolved = $cPr->items->contains(function ($it) {
                $isShortClosed = $it->is_short_closed || ($it->remarks === 'Short Close');
                $convertedQty = (float)$it->converted_qty;
                $shortClosedQty = (float)$it->short_closed_qty;
                $reqQty = (float)$it->qty;
                return !$isShortClosed && ($convertedQty < $reqQty - 0.0001) && (($convertedQty + $shortClosedQty) < $reqQty - 0.0001);
            });

            if ($hasUnresolved) {
                $hasAny = $cPr->items->contains(function ($it) {
                    $isShortClosed = $it->is_short_closed || ($it->remarks === 'Short Close');
                    return (float)$it->converted_qty > 0.0001 || $isShortClosed;
                });

                $cPr->update([
                    'status' => $hasAny ? 'partially_converted' : 'submitted',
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
