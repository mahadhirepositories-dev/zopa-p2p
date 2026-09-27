<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use App\Services\GstService;
use App\Models\PurchaseRequisition;

return new class extends Migration
{
    /**
     * Total Health | PO TH/2026-27/139:
     * - Line Item 1: Register 176 Pages (TH544)
     * - Change Qty from 22.000 to 33.000
     * - Rate: 90.00, GST: 0.00%
     * - New Item Amount: 33 * 90 = 2,970.00 (+990.00)
     * - Recalculate PO Financial Totals and update budget ledger
     * - Update linked PR items and PR conversion status
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // 1. Locate Total Health tenant
        $tenant = DB::table('tenants')
            ->where('name', 'LIKE', '%Total Health%')
            ->orWhere('name', 'LIKE', '%TOTAL HEALTH%')
            ->orWhere('code', 'LIKE', '%TH%')
            ->first();

        $tenantId = $tenant?->id;

        // 2. Locate target PO TH/2026-27/139
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($tenantId) {
                if ($tenantId) {
                    $q->where('tenant_id', $tenantId);
                }
            })
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/139')
                  ->orWhere('po_number', 'LIKE', '%TH%139%')
                  ->orWhere('po_number', 'LIKE', '%2026-27/139%')
                  ->orWhere('po_number', 'LIKE', '%/139')
                  ->orWhere('id', 139);
            })
            ->get();

        foreach ($pos as $po) {
            $poId = $po->id;
            $tId = $po->tenant_id ?: $tenantId;

            // 3. Locate and update Line Item 1 (TH544 / Register 176 Pages)
            $item1 = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 1)
                      ->orWhere('product_code', 'TH544')
                      ->orWhere('description', 'LIKE', '%Register 176 Pages%');
                })
                ->first();

            $newQty = 33.000;

            if ($item1) {
                $netRate = (float) $item1->net_rate;
                $gstRate = (float) $item1->gst_rate;
                $grossRate = round($netRate * (1 + $gstRate / 100), 2);
                $amount = round($grossRate * $newQty, 2);

                DB::table('po_items')->where('id', $item1->id)->update([
                    'qty'        => $newQty,
                    'gross_rate' => $grossRate,
                    'amount'     => $amount,
                    'updated_at' => now(),
                ]);

                // Sync linked PR item if attached
                if (!empty($item1->pr_item_id)) {
                    DB::table('pr_items')->where('id', $item1->pr_item_id)->update([
                        'qty'           => $newQty,
                        'converted_qty' => $newQty,
                        'updated_at'    => now(),
                    ]);
                }
            }

            // 4. Recalculate all item amounts and build items array
            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->orderBy('id')->get();
            $itemsArray = [];

            foreach ($items as $index => $it) {
                $sno = $index + 1;
                $gRate = round((float) $it->net_rate * (1 + (float) $it->gst_rate / 100), 2);
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

            // 5. Recalculate PO Financial Totals
            $vendorAddress   = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation  = DB::table('locations')->where('id', $po->bill_to_location_id)->first();
            $vendorStateCode = $vendorAddress?->state_code ?? '';
            $companyStateCode = $billToLocation?->state_code ?? '';

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

            // 6. Update Budget Ledger Freeze & Consume
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

            // 7. Sync Linked Requisition
            $linkedPrId = $po->pr_id;
            if (!$linkedPrId && !empty($po->pr_reference)) {
                $linkedPrId = DB::table('purchase_requisitions')
                    ->where('tenant_id', $tId)
                    ->where(function ($q) use ($po) {
                        $q->where('pr_number', $po->pr_reference)
                          ->orWhere('pr_ref', $po->pr_reference);
                    })
                    ->value('id');
            }

            if ($linkedPrId) {
                $prModel = PurchaseRequisition::find($linkedPrId);
                if ($prModel) {
                    $newPrEst = DB::table('pr_items')
                        ->where('pr_id', $linkedPrId)
                        ->where('is_short_closed', false)
                        ->selectRaw('SUM(qty * estimated_price) as total')
                        ->value('total') ?? 0;

                    DB::table('purchase_requisitions')->where('id', $linkedPrId)->update([
                        'estimated_amount' => round($newPrEst, 2),
                        'updated_at'       => now(),
                    ]);

                    PurchaseRequisition::syncPrConversion($prModel);
                }
            }

            // 8. Activity Log
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $tId,
                    'entity_type' => 'PO',
                    'entity_id'   => $poId,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'line_items_modified',
                    'meta'        => json_encode([
                        'po_number'   => $po->po_number,
                        'description' => 'Updated Line 1 (TH544 Register 176 Pages) quantity to 33.000',
                        'grand_total' => $totals['grand_total'],
                    ]),
                    'created_at'  => now(),
                ]);
            }
        }

        Cache::flush();
    }

    public function down(): void
    {
    }
};
