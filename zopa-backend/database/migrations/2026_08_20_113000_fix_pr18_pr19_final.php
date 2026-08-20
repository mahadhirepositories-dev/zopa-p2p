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
     * Fix PR18 (ID 29) and PR19 in production:
     * 1. PR18: all 15 items fully converted (Urine Containers = 6, On Cal Strips = 1000) -> status = 'converted'
     * 2. PR19: short-closed items marked -> status = 'short_closed' (Converted & Short Closed)
     */
    public function up(): void
    {
        // ── 1. PR18 Fix ────────────────────────────────────────────────────────
        $pr18s = PurchaseRequisition::where('id', 29)
            ->orWhere('pr_number', 'PR18')
            ->orWhere('pr_number', 'like', '%18%')
            ->orWhere('title', 'like', '%Amrabad%')
            ->get();

        foreach ($pr18s as $pr) {
            // Update all line items in PR18 to full converted_qty
            foreach ($pr->items as $it) {
                $it->update([
                    'converted_qty' => (float)$it->qty,
                ]);
            }

            // Link PO 86 & 97 if found
            $po86 = PurchaseOrder::where('po_number', 'like', '%86%')->first();
            if ($po86) {
                $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po86->id]);
                $uPr = $pr->items()->where(fn($q) => $q->where('sno', 5)->orWhere('description', 'like', '%URINE%'))->first();
                $uPo = $po86->items()->first();
                if ($uPr && $uPo) {
                    $uPo->update(['pr_item_id' => $uPr->id]);
                }
            }

            $po97 = PurchaseOrder::where('po_number', 'like', '%97%')->first();
            if ($po97) {
                $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po97->id]);
                $cPr = $pr->items()->where(fn($q) => $q->where('sno', 13)->orWhere('description', 'like', '%CAL%'))->first();
                $cPo = $po97->items()->first();
                if ($cPr && $cPo) {
                    $cPo->update(['pr_item_id' => $cPr->id]);
                }
            }

            $pr->update([
                'status'       => 'converted',
                'converted_at' => $pr->converted_at ?? now(),
            ]);
        }

        // ── 2. PR19 Fix ────────────────────────────────────────────────────────
        $pr19s = PurchaseRequisition::where('pr_number', 'PR19')
            ->orWhere('pr_number', 'like', '%19%')
            ->orWhere('title', 'like', '%Hematology Reagents%')
            ->get();

        foreach ($pr19s as $pr) {
            // Ensure short-closed items on PR19 are flagged
            foreach ($pr->items as $it) {
                if ((float)$it->converted_qty < (float)$it->qty) {
                    $it->update([
                        'is_short_closed'  => true,
                        'short_closed_qty' => max(0, (float)$it->qty - (float)$it->converted_qty),
                        'remarks'          => 'Short Close',
                    ]);
                }
            }

            $pr->update([
                'status'             => 'short_closed',
                'short_closed_at'    => $pr->short_closed_at ?? now(),
                'short_close_reason' => $pr->short_close_reason ?? 'Short closed as per requirement',
                'converted_at'       => $pr->converted_at ?? now(),
            ]);
        }
    }

    public function down(): void {}
};
