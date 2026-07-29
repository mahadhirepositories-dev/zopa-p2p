<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        $recalculatePoTotals = function ($poId) use ($gstService) {
            $po = DB::table('purchase_orders')->where('id', $poId)->first();
            if (!$po) return;

            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();

            $vendorAddress = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation = DB::table('locations')->where('id', $po->bill_to_location_id)->first();

            $vendorStateCode = $vendorAddress?->state_code ?? '';
            $companyStateCode = $billToLocation?->state_code ?? '';

            $itemsArray = [];
            foreach ($items as $index => $item) {
                $sno = $index + 1;
                $grossRate = (float)$item->net_rate * (1 + (float)$item->gst_rate / 100);
                $amount = round($grossRate * (float)$item->qty, 2);

                DB::table('po_items')->where('id', $item->id)->update([
                    'sno' => $sno,
                    'gross_rate' => $grossRate,
                    'amount' => $amount,
                ]);

                $itemsArray[] = [
                    'net_rate' => (float)$item->net_rate,
                    'qty' => (float)$item->qty,
                    'gst_rate' => (float)$item->gst_rate,
                ];
            }

            $totals = $gstService->calculatePoTotals(
                $itemsArray,
                (float)($po->freight ?? 0),
                $vendorStateCode,
                $companyStateCode,
                (float)($po->freight_gst_rate ?? 0)
            );

            DB::table('purchase_orders')->where('id', $poId)->update([
                'net_total' => $totals['net_total'],
                'freight' => $totals['freight'],
                'tax_amount' => $totals['tax_amount'],
                'grand_total' => $totals['grand_total'],
                'round_off' => $totals['round_off'],
            ]);
        };

        // 1. PO-86: Remove Line Item 9
        $po86Ids = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'LIKE', '%86')
                  ->orWhere('po_number', 'LIKE', '%86%');
            })
            ->pluck('id');

        foreach ($po86Ids as $poId) {
            DB::table('po_items')->where('po_id', $poId)->where('sno', 9)->delete();
            $recalculatePoTotals($poId);
        }

        // 2. PO-85: Remove Line Item 5
        $po85Ids = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'LIKE', '%85')
                  ->orWhere('po_number', 'LIKE', '%85%');
            })
            ->pluck('id');

        foreach ($po85Ids as $poId) {
            DB::table('po_items')->where('po_id', $poId)->where('sno', 5)->delete();
            $recalculatePoTotals($poId);
        }

        // 3. PO-83 (or PO ID 47): Amend item quantities
        $po83Ids = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'LIKE', '%83')
                  ->orWhere('po_number', 'LIKE', '%83%')
                  ->orWhere('po_number', 'LIKE', '%73')
                  ->orWhere('id', 47);
            })
            ->pluck('id');

        $qtyByCode = [
            'TH434' => 5,
            'TH435' => 4,
            'TH436' => 5,
            'TH437' => 5,
            'TH438' => 7,
        ];

        $qtyBySno = [
            1 => 5,
            2 => 4,
            3 => 5,
            4 => 5,
            5 => 7,
        ];

        foreach ($po83Ids as $poId) {
            $items = DB::table('po_items')->where('po_id', $poId)->get();
            foreach ($items as $item) {
                $newQty = null;
                if (!empty($item->product_code) && isset($qtyByCode[$item->product_code])) {
                    $newQty = $qtyByCode[$item->product_code];
                } elseif (isset($qtyBySno[$item->sno]) && $item->sno <= 5) {
                    $newQty = $qtyBySno[$item->sno];
                }

                if ($newQty !== null) {
                    DB::table('po_items')->where('id', $item->id)->update(['qty' => $newQty]);
                }
            }
            $recalculatePoTotals($poId);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
