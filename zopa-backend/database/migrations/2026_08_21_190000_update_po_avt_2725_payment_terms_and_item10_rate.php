<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Update PO AVT2026-2725:
     * 1. Payment terms -> 50% Advance, 50% Delivery (30 days credit)
     * 2. Line 10 (Telco Collar Canvas / AVT36) Net Rate -> 103.00 (changed from 295.00)
     * 3. Recalculate item amounts and PO header totals.
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        $pos = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'AVT2026-2725')
                  ->orWhere('po_number', 'AVT/2026-27/25')
                  ->orWhere('po_number', 'AVT-2026-27-25')
                  ->orWhere('po_number', 'AVT2026-27/25')
                  ->orWhere('po_number', 'LIKE', '%2725%')
                  ->orWhere('po_number', 'LIKE', '%AVT%25%')
                  ->orWhereExists(function ($sub) {
                      $sub->select(DB::raw(1))
                          ->from('po_items')
                          ->whereColumn('po_items.po_id', 'purchase_orders.id')
                          ->where(function ($iq) {
                              $iq->where('product_code', 'AVT36')
                                ->orWhere('description', 'LIKE', '%Telco Collar Canvas%');
                          });
                  });
            })
            ->get();

        foreach ($pos as $po) {
            $poId = $po->id;

            // 1. Update Payment Terms: 50% Advance, 50% on Delivery (30 days credit)
            $paymentTerms = [
                [
                    'stage'       => 'Advance',
                    'percentage'  => 50,
                    'credit_days' => 0,
                ],
                [
                    'stage'       => 'Delivery',
                    'percentage'  => 50,
                    'credit_days' => 30,
                ],
            ];

            DB::table('purchase_orders')->where('id', $poId)->update([
                'payment_terms_json' => json_encode($paymentTerms),
            ]);

            // 2. Update Line 10 (Telco Collar Canvas / AVT36) Net Rate to 103.00
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('product_code', 'AVT36')
                      ->orWhere('description', 'LIKE', '%Telco Collar Canvas%')
                      ->orWhere('sno', 10);
                })
                ->update([
                    'net_rate'   => 103.00,
                    'gst_rate'   => 5.00,
                    'gross_rate' => 108.15,
                    'amount'     => 5407.50,
                ]);

            // 3. Recalculate all item amounts and PO totals
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
                    'sno'        => $sno,
                    'gross_rate' => $grossRate,
                    'amount'     => $amount,
                ]);

                $itemsArray[] = [
                    'net_rate' => (float)$item->net_rate,
                    'qty'      => (float)$item->qty,
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
                'net_total'   => $totals['net_total'],
                'freight'     => $totals['freight'],
                'tax_amount'  => $totals['tax_amount'],
                'grand_total' => $totals['grand_total'],
                'round_off'   => $totals['round_off'],
            ]);
        }
    }

    public function down(): void {}
};
