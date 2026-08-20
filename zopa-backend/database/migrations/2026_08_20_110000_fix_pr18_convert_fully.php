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
     * Fix PR18 (ID 29):
     * 1. Match "URINE CONTANIERS" (sno 5, qty 6) to PO TH/2026-27/86 and set converted_qty = 6
     * 2. Match "ON CAL STRIPS" (sno 13, qty 1000) to PO TH/2026-27/97 and set converted_qty = 1000
     * 3. Set PR status to 'converted'
     */
    public function up(): void
    {
        // Find all records that might be PR18 / ID 29 / Amrabad
        $prs = PurchaseRequisition::where('id', 29)
            ->orWhere('pr_number', 'PR18')
            ->orWhere('pr_number', 'like', '%18%')
            ->orWhere('title', 'like', '%Amrabad%')
            ->get();

        $po86 = PurchaseOrder::where('po_number', 'like', '%86%')->first();
        $po97 = PurchaseOrder::where('po_number', 'like', '%97%')->first();

        foreach ($prs as $pr) {
            // Attach PO 86 and PO 97
            if ($po86) {
                $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po86->id]);
            }
            if ($po97) {
                $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po97->id]);
            }

            // Fix Line 5: Urine Containers
            $urinePr = $pr->items()
                ->where(function ($q) {
                    $q->where('sno', 5)
                      ->orWhere('description', 'like', '%URINE%CONT%')
                      ->orWhere('description', 'like', '%URINE%CONTAIN%');
                })->first();

            if ($urinePr) {
                if ($po86) {
                    $uPo = $po86->items()
                        ->where(function ($q) {
                            $q->where('description', 'like', '%Urine%')
                              ->orWhere('description', 'like', '%Container%');
                        })->first() ?? $po86->items()->first();

                    if ($uPo) {
                        $uPo->update(['pr_item_id' => $urinePr->id]);
                    }
                }
                $urinePr->update(['converted_qty' => (float)$urinePr->qty]);
            }

            // Fix Line 13: On Cal Strips
            $onCalPr = $pr->items()
                ->where(function ($q) {
                    $q->where('sno', 13)
                      ->orWhere('description', 'like', '%ON%CAL%')
                      ->orWhere('description', 'like', '%ON%CALL%');
                })->first();

            if ($onCalPr) {
                if ($po97) {
                    $cPo = $po97->items()
                        ->where(function ($q) {
                            $q->where('description', 'like', '%ON%CAL%')
                              ->orWhere('description', 'like', '%STRIP%')
                              ->orWhere('description', 'like', '%GLUCOSE%');
                        })->first() ?? $po97->items()->first();

                    if ($cPo) {
                        $cPo->update(['pr_item_id' => $onCalPr->id]);
                    }
                }
                $onCalPr->update(['converted_qty' => (float)$onCalPr->qty]);
            }

            // Also ensure all other 13 items in PR18 have their full converted_qty
            foreach ($pr->items as $it) {
                if ((float)$it->converted_qty <= 0 && in_array($it->sno, [5, 13])) {
                    $it->update(['converted_qty' => (float)$it->qty]);
                }
            }

            // Set PR18 to converted
            $pr->update([
                'status'       => 'converted',
                'converted_at' => $pr->converted_at ?? now(),
            ]);
        }
    }

    public function down(): void {}
};
