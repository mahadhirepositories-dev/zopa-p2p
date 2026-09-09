<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Update PO TH/2026-27/112 (Total Health):
     * Line Item 6: Apollo Pain Relief Gel 30 Gm (TH246)
     * - Change Qty from 4800 to 3000
     * - Net rate: 35.00, GST rate: 5%
     * - Gross rate: 36.75, Amount: 110,250.00
     * - Recalculate PO totals and update budget ledger
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // 1. Find PO TH/2026-27/112
        $pos = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/112')
                  ->orWhere('po_number', 'LIKE', '%TH%112%')
                  ->orWhere('id', 115);
            })
            ->get();

        foreach ($pos as $po) {
            $poId = $po->id;

            // 2. Find and update line item 6 (Apollo Pain Relief Gel 30 Gm / TH246)
            $item = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 6)
                      ->orWhere('product_code', 'TH246')
                      ->orWhere('description', 'LIKE', '%Apollo Pain Relief Gel%');
                })
                ->first();

            if ($item) {
                $newQty = 3000.00;
                $netRate = 35.00;
                $gstRate = (float) $item->gst_rate > 0 ? (float) $item->gst_rate : 5.00;
                $grossRate = $netRate * (1 + $gstRate / 100);
                $amount = round($grossRate * $newQty, 2);

                $oldQty = (float) $item->qty;
                $qtyDiff = $oldQty - $newQty;

                DB::table('po_items')->where('id', $item->id)->update([
                    'qty'        => $newQty,
                    'net_rate'   => $netRate,
                    'gst_rate'   => $gstRate,
                    'gross_rate' => $grossRate,
                    'amount'     => $amount,
                    'updated_at' => now(),
                ]);

                // Update PR item conversion tracking if linked
                if (!empty($item->pr_item_id) && $qtyDiff > 0) {
                    $prItem = DB::table('pr_items')->where('id', $item->pr_item_id)->first();
                    if ($prItem) {
                        DB::table('pr_items')->where('id', $item->pr_item_id)->update([
                            'converted_qty' => max(0, (float) $prItem->converted_qty - $qtyDiff),
                            'updated_at'    => now(),
                        ]);
                    }
                }
            }

            // 3. Recalculate all item amounts and PO totals
            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();
            $vendorAddress = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation = DB::table('locations')->where('id', $po->bill_to_location_id)->first();

            $vendorStateCode = $vendorAddress?->state_code ?? '';
            $companyStateCode = $billToLocation?->state_code ?? '';

            $itemsArray = [];
            foreach ($items as $index => $it) {
                $sno = $index + 1;
                $gRate = (float) $it->net_rate * (1 + (float) $it->gst_rate / 100);
                $amt = round($gRate * (float) $it->qty, 2);

                DB::table('po_items')->where('id', $it->id)->update([
                    'sno'        => $sno,
                    'gross_rate' => $gRate,
                    'amount'     => $amt,
                ]);

                $itemsArray[] = [
                    'net_rate' => (float) $it->net_rate,
                    'qty'      => (float) $it->qty,
                    'gst_rate' => (float) $it->gst_rate,
                ];
            }

            $totals = $gstService->calculatePoTotals(
                $itemsArray,
                (float) ($po->freight ?? 0),
                $vendorStateCode,
                $companyStateCode,
                (float) ($po->freight_gst_rate ?? 0),
                (float) ($po->discount ?? 0)
            );

            DB::table('purchase_orders')->where('id', $poId)->update([
                'net_total'   => $totals['net_total'],
                'freight'     => $totals['freight'],
                'tax_amount'  => $totals['tax_amount'],
                'discount'    => $totals['discount'],
                'grand_total' => $totals['grand_total'],
                'round_off'   => $totals['round_off'],
                'updated_at'  => now(),
            ]);

            // 4. Update Budget Ledger if entry exists for this PO
            if (Schema::hasTable('budget_ledger')) {
                DB::table('budget_ledger')
                    ->where('reference_type', 'PO')
                    ->where('reference_id', $poId)
                    ->where('action', 'freeze')
                    ->update([
                        'freeze_amount' => $totals['grand_total'],
                        'updated_at'    => now(),
                    ]);

                DB::table('budget_ledger')
                    ->where('reference_type', 'PO')
                    ->where('reference_id', $poId)
                    ->where('action', 'consume')
                    ->update([
                        'consume_amount' => $totals['grand_total'],
                        'updated_at'     => now(),
                    ]);
            }
        }

        Cache::flush();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
