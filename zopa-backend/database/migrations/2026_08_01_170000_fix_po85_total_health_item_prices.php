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

        // Find PO 85 (or ID 50)
        $poIds = DB::table('purchase_orders')
            ->where('id', 50)
            ->orWhere('po_number', 'LIKE', '%85')
            ->orWhere('po_number', 'LIKE', '%85%')
            ->pluck('id');

        foreach ($poIds as $poId) {
            $po = DB::table('purchase_orders')->where('id', $poId)->first();
            if (!$po) continue;

            // Item 1: ABX MINDIL 20 L / TH16 -> Net Rate 4850
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('description', 'LIKE', '%MINDIL%');
                })
                ->update([
                    'net_rate' => 4850.00,
                    'gross_rate' => 4850.00 * 1.05,
                    'amount' => round((4850.00 * 1.05) * 3, 2),
                ]);

            // Item 2: ABX MINCLEAN 1 LETER / TH17 -> Net Rate 1450
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('description', 'LIKE', '%MINCLEAN%');
                })
                ->update([
                    'net_rate' => 1450.00,
                    'gross_rate' => 1450.00 * 1.05,
                    'amount' => round((1450.00 * 1.05) * 5, 2),
                ]);

            // Recalculate PO totals
            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();

            $vendorAddress = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation = DB::table('locations')->where('id', $po->bill_to_location_id)->first();

            $vendorStateCode = $vendorAddress?->state_code ?? '';
            $companyStateCode = $billToLocation?->state_code ?? '';

            $itemsArray = [];
            foreach ($items as $item) {
                $itemsArray[] = [
                    'net_rate' => (float)$item->net_rate,
                    'qty' => (float)$item->qty,
                    'gst_rate' => (float)($item->gst_rate ?? 5),
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
