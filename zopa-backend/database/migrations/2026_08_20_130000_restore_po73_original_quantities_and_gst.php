<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Restore PO-TH-2026-27-73 original correct line item quantities, GST rates, and totals.
     * An earlier migration intended for PO-83 had inadvertently matched PO-73 (due to 'LIKE %73'),
     * modifying lines 1-5 quantities (10800->5, 2310->4, 75->5, 300->5, 480->7) and line 5 GST (5%->18%).
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        $po73List = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/73')
                  ->orWhere('po_number', 'LIKE', '%/73')
                  ->orWhere('po_number', 'LIKE', '%-73');
            })
            ->get();

        foreach ($po73List as $po) {
            $poId = $po->id;

            // 1. Line 1: Aceclofenac – 100 mg Tab (TH58)
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 1)
                      ->orWhere('product_code', 'TH58')
                      ->orWhere('description', 'LIKE', '%Aceclofenac%');
                })
                ->update([
                    'qty'        => 10800,
                    'net_rate'   => 0.83,
                    'gst_rate'   => 5.00,
                    'gross_rate' => 0.8715,
                    'amount'     => 9412.20,
                ]);

            // 2. Line 2: Ecosprin 75 Mg (Aspirin) Tab (TH195)
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 2)
                      ->orWhere('product_code', 'TH195')
                      ->orWhere('description', 'LIKE', '%Ecosprin%');
                })
                ->update([
                    'qty'        => 2310,
                    'net_rate'   => 0.26,
                    'gst_rate'   => 5.00,
                    'gross_rate' => 0.2730,
                    'amount'     => 630.63,
                ]);

            // 3. Line 3: Albendazole Oral Susp (10ml) Syp (TH305)
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 3)
                      ->orWhere('product_code', 'TH305')
                      ->orWhere('description', 'LIKE', '%Albendazole Oral Susp%');
                })
                ->update([
                    'qty'        => 75,
                    'net_rate'   => 7.60,
                    'gst_rate'   => 5.00,
                    'gross_rate' => 7.9800,
                    'amount'     => 598.50,
                ]);

            // 4. Line 4: Albendazole – 400 mg Tab (TH64)
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 4)
                      ->orWhere('product_code', 'TH64')
                      ->orWhere('description', 'LIKE', '%Albendazole – 400%')
                      ->orWhere('description', 'LIKE', '%Albendazole - 400%')
                      ->orWhere('description', 'LIKE', '%Albendazole 400%');
                })
                ->update([
                    'qty'        => 300,
                    'net_rate'   => 1.90,
                    'gst_rate'   => 5.00,
                    'gross_rate' => 1.9950,
                    'amount'     => 598.50,
                ]);

            // 5. Line 5: Aluminium Hydroxide 200 mg, Magnesium Hydroxide 250 mg, Dimethicone 50 mg 200ml Syp (TH307)
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 5)
                      ->orWhere('product_code', 'TH307')
                      ->orWhere('description', 'LIKE', '%Aluminium Hydroxide%');
                })
                ->update([
                    'qty'        => 480,
                    'net_rate'   => 18.50,
                    'gst_rate'   => 5.00,
                    'gross_rate' => 19.4250,
                    'amount'     => 9324.00,
                ]);

            // Recalculate totals for PO 73
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
