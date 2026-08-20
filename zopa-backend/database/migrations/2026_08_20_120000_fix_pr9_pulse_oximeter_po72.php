<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseOrder;
use App\Models\PoItem;
use App\Models\PrItem;

return new class extends Migration
{
    /**
     * Fix PR9 (ID 19) - Pulse Oximeter released in PO 72:
     * 1. Attach PO 72 (TH/2026-27/72) to PR9
     * 2. Link Pulse Oximeter item (sno 2, qty 3)
     * 3. Set Pulse Oximeter converted_qty = 3
     * 4. Update PR9 to 'short_closed' (Converted & Short Closed)
     */
    public function up(): void
    {
        $prs = PurchaseRequisition::where('id', 19)
            ->orWhere('pr_number', 'PR9')
            ->orWhere('pr_number', 'like', '%PR9%')
            ->orWhere('title', 'like', '%Meghalaya-Equipment%')
            ->get();

        $po72 = PurchaseOrder::where('po_number', 'like', '%72%')->first();

        foreach ($prs as $pr) {
            $oximeterPr = $pr->items()
                ->where(function ($q) {
                    $q->where('sno', 2)
                      ->orWhere('description', 'like', '%Pulse%')
                      ->orWhere('description', 'like', '%Oximeter%');
                })->first();

            if ($oximeterPr) {
                if ($po72) {
                    $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po72->id]);
                    $oximeterPo = $po72->items()
                        ->where(function ($q) {
                            $q->where('description', 'like', '%Pulse%')
                              ->orWhere('description', 'like', '%Oximeter%');
                        })->first() ?? $po72->items()->first();

                    if ($oximeterPo) {
                        $oximeterPo->update(['pr_item_id' => $oximeterPr->id]);
                    }
                }
                $oximeterPr->update(['converted_qty' => (float)$oximeterPr->qty]);
            }

            // Ensure short-closed lines 4-8 on PR9 are flagged
            foreach ($pr->items as $it) {
                if (in_array($it->sno, [4, 5, 6, 7, 8]) || $it->remarks === 'Short Close') {
                    $it->update([
                        'is_short_closed'  => true,
                        'short_closed_qty' => (float)$it->qty,
                        'remarks'          => 'Short Close',
                    ]);
                }
            }

            PurchaseRequisition::syncPrConversion($pr);

            // Ensure status is Converted & Short Closed
            $pr->update([
                'status'             => 'short_closed',
                'short_closed_at'    => $pr->short_closed_at ?? now(),
                'short_close_reason' => $pr->short_close_reason ?? 'Short closed remaining items',
                'converted_at'       => $pr->converted_at ?? now(),
            ]);
        }
    }

    public function down(): void {}
};
