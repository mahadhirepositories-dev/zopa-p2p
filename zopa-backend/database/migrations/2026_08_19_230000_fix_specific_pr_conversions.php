<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseOrder;
use App\Models\PoItem;
use App\Models\PrItem;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. 2601/02/TOTALHEALTH-PR-2026-0001: PLANE TUBES <-> Plain Tubes in PO TH/2026-27/49
        $pr1 = PurchaseRequisition::where('pr_number', 'like', '%2601/02/TOTALHEALTH-PR-2026-0001%')->orWhere('pr_ref', 'like', '%2601/02/TOTALHEALTH-PR-2026-0001%')->first();
        $po49 = PurchaseOrder::where('po_number', 'like', '%49%')->first();
        if ($pr1 && $po49) {
            $planePrItem = $pr1->items()->where(function($q) {
                $q->where('description', 'like', '%PLANE TUBE%')->orWhere('description', 'like', '%PLAIN TUBE%');
            })->first();
            $plainPoItem = $po49->items()->where(function($q) {
                $q->where('description', 'like', '%Plain Tube%')->orWhere('description', 'like', '%Plane Tube%');
            })->first();
            if ($planePrItem && $plainPoItem) {
                $plainPoItem->update(['pr_item_id' => $planePrItem->id]);
            }
            PurchaseRequisition::syncPrConversion($pr1);
        }

        // 2. PR2: Albendazole-400 Tablet in PO TH/2026-27/52
        $pr2 = PurchaseRequisition::where('pr_number', 'PR2')->orWhere('pr_number', 'PR-2')->orWhere('pr_ref', 'PR2')->first();
        $po52 = PurchaseOrder::where('po_number', 'like', '%52%')->first();
        if ($pr2 && $po52) {
            $albenPr = $pr2->items()->where('description', 'like', '%Albendazole%')->first();
            $albenPo = $po52->items()->where('description', 'like', '%Albendazole%')->first();
            if ($albenPr && $albenPo) {
                $albenPo->update(['pr_item_id' => $albenPr->id]);
            }
            PurchaseRequisition::syncPrConversion($pr2);
        }

        // 3. PR3: Albendazole in PO TH/2026-27/53
        $pr3 = PurchaseRequisition::where('pr_number', 'PR3')->orWhere('pr_number', 'PR-3')->orWhere('pr_ref', 'PR3')->first();
        $po53 = PurchaseOrder::where('po_number', 'like', '%53%')->first();
        if ($pr3 && $po53) {
            $albenPrItems = $pr3->items()->where('description', 'like', '%Albendazole%')->get();
            $albenPoItems = $po53->items()->where('description', 'like', '%Albendazole%')->get();
            foreach ($albenPoItems as $pi) {
                if (empty($pi->pr_item_id)) {
                    $targetPr = $albenPrItems->first(fn($it) => $it->converted_qty < $it->qty) ?? $albenPrItems->first();
                    if ($targetPr) {
                        $pi->update(['pr_item_id' => $targetPr->id]);
                    }
                }
            }
            PurchaseRequisition::syncPrConversion($pr3);
        }

        // 4. PR5: Lab Bill Book in PO TH/2026-27/55
        $pr5 = PurchaseRequisition::where('pr_number', 'PR5')->orWhere('pr_number', 'PR-5')->orWhere('pr_ref', 'PR5')->first();
        $po55 = PurchaseOrder::where('po_number', 'like', '%55%')->first();
        if ($pr5 && $po55) {
            foreach ($po55->items as $pi) {
                $matchPr = $pr5->items()->where('description', 'like', '%Bill Book%')->first();
                if ($matchPr) {
                    $pi->update(['pr_item_id' => $matchPr->id]);
                }
            }
            PurchaseRequisition::syncPrConversion($pr5);
        }

        // 5. PR7: Pantoprazole 40 mg tablet & Methylcobalmin Tablet 500 Mcg in POs 57, 58, 59
        $pr7 = PurchaseRequisition::where('pr_number', 'PR7')->orWhere('pr_number', 'PR-7')->orWhere('pr_ref', 'PR7')->first();
        if ($pr7) {
            $poIds = PurchaseOrder::where(function($q) {
                $q->where('po_number', 'like', '%57%')
                  ->orWhere('po_number', 'like', '%58%')
                  ->orWhere('po_number', 'like', '%59%');
            })->pluck('id');

            $pantoPr = $pr7->items()->where('description', 'like', '%Pantoprazole%')->first();
            $methylPr = $pr7->items()->where(function($q) {
                $q->where('description', 'like', '%Methylcobal%')->orWhere('description', 'like', '%Methylcobalamin%');
            })->first();

            if ($pantoPr) {
                PoItem::whereIn('po_id', $poIds)->where('description', 'like', '%Pantoprazole%')->update(['pr_item_id' => $pantoPr->id]);
            }
            if ($methylPr) {
                PoItem::whereIn('po_id', $poIds)->where(function($q) {
                    $q->where('description', 'like', '%Methylcobal%')->orWhere('description', 'like', '%Methylcobalamin%');
                })->update(['pr_item_id' => $methylPr->id]);
            }

            PurchaseRequisition::syncPrConversion($pr7);
        }

        // 6. PR8: Fix 11999.001 -> 12000.000
        $pr8 = PurchaseRequisition::where('pr_number', 'PR8')->orWhere('pr_number', 'PR-8')->orWhere('pr_ref', 'PR8')->first();
        if ($pr8) {
            PurchaseRequisition::syncPrConversion($pr8);
        }

        // General auto-heal on all PRs
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $pr) {
            PurchaseRequisition::syncPrConversion($pr);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
