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
     * Fix and convert PR15, PR8, PR7 and all PRs with short-closed or fully converted items.
     */
    public function up(): void
    {
        // ── 1. PR 15 Fix ───────────────────────────────────────────────────────
        $pr15List = PurchaseRequisition::where('pr_number', 'PR15')
            ->orWhere('pr_number', 'PR-15')
            ->orWhere('pr_ref', 'PR15')
            ->orWhere('pr_ref', 'PR-15')
            ->orWhere('id', 26)
            ->get();

        $po73 = PurchaseOrder::where('po_number', 'TH/2026-27/73')
            ->orWhere('po_number', 'like', '%/73')
            ->first();

        foreach ($pr15List as $pr) {
            if ($po73) {
                $pr->linkedPurchaseOrders()->syncWithoutDetaching([$po73->id]);
                if (empty($pr->pr_id)) {
                    $po73->update(['pr_id' => $pr->id]);
                }
            }

            // Sync all items in PR15 from PO 73 or set converted_qty = qty
            foreach ($pr->items as $it) {
                $matchedPoItem = null;
                if ($po73) {
                    $matchedPoItem = $po73->items->firstWhere('sno', $it->sno);
                    if (!$matchedPoItem && $it->product_id) {
                        $matchedPoItem = $po73->items->firstWhere('product_id', $it->product_id);
                    }
                }

                if ($matchedPoItem) {
                    $matchedPoItem->update(['pr_item_id' => $it->id]);
                    $it->update(['converted_qty' => (float)$it->qty]);
                } else {
                    // Item in PR15 fully converted
                    $it->update(['converted_qty' => (float)$it->qty]);
                }
            }

            PurchaseRequisition::syncPrConversion($pr);

            $hasShort = $pr->items()->where('is_short_closed', true)->orWhere('remarks', 'Short Close')->exists();
            $pr->update([
                'status'       => $hasShort ? 'short_closed' : 'converted',
                'converted_at' => $pr->converted_at ?? now(),
            ]);
        }

        // ── 2. PR 8 Fix ────────────────────────────────────────────────────────
        $pr8List = PurchaseRequisition::where('pr_number', 'PR8')
            ->orWhere('pr_number', 'PR-8')
            ->orWhere('pr_ref', 'PR8')
            ->orWhere('pr_ref', 'PR-8')
            ->get();

        foreach ($pr8List as $pr) {
            foreach ($pr->items as $it) {
                if ((float)$it->converted_qty < (float)$it->qty) {
                    $it->update([
                        'is_short_closed'  => true,
                        'short_closed_qty' => max(0, (float)$it->qty - (float)$it->converted_qty),
                        'remarks'          => 'Short Close',
                    ]);
                }
            }

            PurchaseRequisition::syncPrConversion($pr);

            $pr->update([
                'status'             => 'short_closed',
                'short_closed_at'    => $pr->short_closed_at ?? now(),
                'short_close_reason' => $pr->short_close_reason ?? 'Short closed remaining items',
                'converted_at'       => $pr->converted_at ?? now(),
            ]);
        }

        // ── 3. PR 7 Fix ────────────────────────────────────────────────────────
        $pr7List = PurchaseRequisition::where('pr_number', 'PR7')
            ->orWhere('pr_number', 'PR-7')
            ->orWhere('pr_ref', 'PR7')
            ->orWhere('pr_ref', 'PR-7')
            ->get();

        foreach ($pr7List as $pr) {
            foreach ($pr->items as $it) {
                if ((float)$it->converted_qty < (float)$it->qty) {
                    $it->update([
                        'is_short_closed'  => true,
                        'short_closed_qty' => max(0, (float)$it->qty - (float)$it->converted_qty),
                        'remarks'          => 'Short Close',
                    ]);
                }
            }

            PurchaseRequisition::syncPrConversion($pr);

            $pr->update([
                'status'             => 'short_closed',
                'short_closed_at'    => $pr->short_closed_at ?? now(),
                'short_close_reason' => $pr->short_close_reason ?? 'Short closed remaining items',
                'converted_at'       => $pr->converted_at ?? now(),
            ]);
        }

        // ── 4. Resync ALL PRs across the system ────────────────────────────────
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $p) {
            PurchaseRequisition::syncPrConversion($p);
        }
    }

    public function down(): void {}
};
