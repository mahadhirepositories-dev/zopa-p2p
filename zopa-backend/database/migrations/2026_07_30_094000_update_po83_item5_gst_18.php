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

        // Target PO-83 in Total Health tenant
        $po83Ids = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'LIKE', '%83')
                  ->orWhere('po_number', 'LIKE', '%83%')
                  ->orWhere('po_number', 'LIKE', '%73')
                  ->orWhere('id', 47);
            })
            ->pluck('id');

        foreach ($po83Ids as $poId) {
            // Update item 5 (Probe Cleanser / TH438) GST to 18%
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 5)
                      ->orWhere('product_code', 'TH438')
                      ->orWhere('description', 'LIKE', '%Probe Cleanser%');
                })
                ->update([
                    'gst_rate' => 18.00,
                ]);

            // Recalculate all item amounts and PO totals
            $po = DB::table('purchase_orders')->where('id', $poId)->first();
            if (!$po) continue;

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
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
