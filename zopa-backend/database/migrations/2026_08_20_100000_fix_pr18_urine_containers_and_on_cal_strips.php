<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseOrder;
use App\Models\PoItem;
use App\Models\PrItem;

return new class extends Migration
{
    /**
     * Fix PR18 (ID 29):
     * 1. Match "URINE CONTANIERS" (sno 5, qty 6) to PO TH/2026-27/86
     * 2. Link PO TH/2026-27/97 and match "ON CAL STRIPS" (sno 13, qty 1000)
     * 3. Set both fully converted and update PR18 status to 'converted'
     */
    public function up(): void
    {
        $prs = PurchaseRequisition::where('id', 29)
            ->orWhere('pr_number', 'PR18')
            ->orWhere('pr_number', 'like', '%18%')
            ->orWhere('title', 'like', '%Amrabad%')
            ->get();

        $po86 = PurchaseOrder::where('po_number', 'like', '%/86')
            ->orWhere('po_number', 'like', '%-86')
            ->first();

        $po97 = PurchaseOrder::where('po_number', 'like', '%/97')
            ->orWhere('po_number', 'like', '%-97')
            ->first();

        foreach ($prs as $pr) {
            // 1. Urine Containers fix (PO 86)
            $urinePrItem = $pr->items()
                ->where(function ($q) {
                    $q->where('description', 'like', '%URINE%CONT%')
                      ->orWhere('description', 'like', '%URINE%CONTAIN%')
                      ->orWhere('sno', 5);
                })->first();

            if ($urinePrItem) {
                if ($po86) {
                    $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po86->id]);
                    $urinePoItem = $po86->items()
                        ->where(function ($q) {
                            $q->where('description', 'like', '%Urine%')
                              ->orWhere('description', 'like', '%Container%');
                        })->first();

                    if ($urinePoItem) {
                        $urinePoItem->update(['pr_item_id' => $urinePrItem->id]);
                    }
                }
                $urinePrItem->update(['converted_qty' => (float)$urinePrItem->qty]);
            }

            // 2. On Cal Strips fix (PO 97)
            $onCalPrItem = $pr->items()
                ->where(function ($q) {
                    $q->where('description', 'like', '%ON%CAL%')
                      ->orWhere('description', 'like', '%ON%CALL%')
                      ->orWhere('sno', 13);
                })->first();

            if ($onCalPrItem) {
                if ($po97) {
                    $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po97->id]);
                    $onCalPoItem = $po97->items()
                        ->where(function ($q) {
                            $q->where('description', 'like', '%ON%CAL%')
                              ->orWhere('description', 'like', '%STRIP%')
                              ->orWhere('description', 'like', '%GLUCOSE%');
                        })->first() ?? $po97->items()->first();

                    if ($onCalPoItem) {
                        $onCalPoItem->update(['pr_item_id' => $onCalPrItem->id]);
                    }
                }
                $onCalPrItem->update(['converted_qty' => (float)$onCalPrItem->qty]);
            }

            PurchaseRequisition::syncPrConversion($pr);
        }

        // Full resync for all PRs
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $p) {
            PurchaseRequisition::syncPrConversion($p);
        }
    }

    public function down(): void {}
};
