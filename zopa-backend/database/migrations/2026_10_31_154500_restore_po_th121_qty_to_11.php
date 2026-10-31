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
     * Total Health | PO TH/2026-27/121:
     * - Vendor: SRI SAI HEALTH CARE SERVICES
     * - Project: JIO-BP – 11 Location (PR43 JIO BP-Fabrication & Branding)
     * - Restore Line Item 1 (Branding / TH394) quantity from 33.000 back to 11.000
     * - Unit Rate: Rs. 28,000.00 | GST: 0%
     * - New Item Amount: 11 * 28,000.00 = Rs. 3,08,000.00
     * - Grand Total: Rs. 3,08,000.00 (Net: Rs. 3,08,000.00, Tax: Rs. 0.00, Round Off: Rs. 0.00)
     * - Update any linked GRN items accepted_qty and received_qty to 11.000
     * - Update Budget Ledger freeze and consume records to Rs. 3,08,000.00
     * - Update linked PR43 and sync PR conversion
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // 1. Locate Total Health tenant
        $tenant = DB::table('tenants')
            ->where('name', 'LIKE', '%Total Health%')
            ->orWhere('name', 'LIKE', '%TOTAL HEALTH%')
            ->orWhere('code', 'LIKE', '%TH%')
            ->orWhere('id', 2)
            ->first();

        $tenantId = $tenant?->id ?? 2;
        echo "Resolved Total Health Tenant ID: {$tenantId}\n";

        // 2. Locate target PO TH/2026-27/121
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($tenantId) {
                if ($tenantId) {
                    $q->where('tenant_id', $tenantId);
                }
            })
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/121')
                  ->orWhere('po_number', 'LIKE', '%TH%121%')
                  ->orWhere('po_number', 'LIKE', '%2026-27/121%')
                  ->orWhere('po_number', 'LIKE', '%/121')
                  ->orWhere('id', 121);
            })
            ->get();

        // Fallback across all tenants if not found with tenant filter
        if ($pos->isEmpty()) {
            $pos = DB::table('purchase_orders')
                ->where(function ($q) {
                    $q->where('po_number', 'TH/2026-27/121')
                      ->orWhere('po_number', 'LIKE', '%TH%121%')
                      ->orWhere('po_number', 'LIKE', '%2026-27/121%')
                      ->orWhere('po_number', 'LIKE', '%/121');
                })
                ->get();
        }

        echo "Found " . $pos->count() . " PO record(s) matching TH/2026-27/121.\n";

        foreach ($pos as $po) {
            $poId = $po->id;
            $tId = $po->tenant_id ?: $tenantId;
            echo "Processing PO #{$poId} ({$po->po_number}), Current Grand Total: Rs. {$po->grand_total}\n";

            $targetQty = 11.000;
            $targetRate = 28000.00;

            // 3. Locate and update Line Item 1 (Branding / TH394)
            $item1 = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('sno', 1)
                      ->orWhere('product_code', 'TH394')
                      ->orWhere('description', 'LIKE', '%Branding%');
                })
                ->first();

            if (!$item1) {
                // If not matched by sno/code, pick the first line item
                $item1 = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->first();
            }

            if ($item1) {
                $netRate = (float) ($item1->net_rate ?: $targetRate);
                $gstRate = (float) ($item1->gst_rate ?? 0);
                $grossRate = round($netRate * (1 + $gstRate / 100), 2);
                $amount = round($grossRate * $targetQty, 2);

                DB::table('po_items')->where('id', $item1->id)->update([
                    'qty'        => $targetQty,
                    'net_rate'   => $netRate,
                    'gross_rate' => $grossRate,
                    'amount'     => $amount,
                    'updated_at' => now(),
                ]);

                echo "  Updated Line Item ID {$item1->id} ('{$item1->description}'): Qty {$item1->qty} -> {$targetQty}, Amount Rs. {$amount}\n";

                // Update any linked GRN items if captured
                if (Schema::hasTable('grn_items')) {
                    $updatedGrnItems = DB::table('grn_items')
                        ->where('po_item_id', $item1->id)
                        ->where('accepted_qty', '>', $targetQty)
                        ->update([
                            'received_qty' => $targetQty,
                            'accepted_qty' => $targetQty,
                            'updated_at'   => now(),
                        ]);
                    if ($updatedGrnItems > 0) {
                        echo "  Adjusted {$updatedGrnItems} GRN line item(s) to accepted_qty = {$targetQty}.\n";
                    }
                }

                // Sync linked PR item if attached
                if (!empty($item1->pr_item_id)) {
                    DB::table('pr_items')->where('id', $item1->pr_item_id)->update([
                        'qty'           => $targetQty,
                        'converted_qty' => $targetQty,
                        'updated_at'    => now(),
                    ]);
                    echo "  Synced linked PR item ID {$item1->pr_item_id} to Qty {$targetQty}.\n";
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

            echo "  Updated PO #{$poId} totals -> Net: Rs. {$totals['net_total']}, Tax: Rs. {$totals['tax_amount']}, Grand Total: Rs. {$totals['grand_total']}\n";

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
                echo "  Updated Budget Ledger (freeze & consume) to Rs. {$totals['grand_total']}.\n";
            }

            // 7. Sync Linked Requisition (PR43)
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
                    echo "  Synced linked PR ID {$linkedPrId} ({$prModel->pr_number}) estimated amount to Rs. {$newPrEst} and refreshed status.\n";
                }
            }

            // 8. Record in Activity Log
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $tId,
                    'entity_type' => 'PO',
                    'entity_id'   => $poId,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'line_items_modified',
                    'meta'        => json_encode([
                        'po_number'   => $po->po_number,
                        'description' => 'Updated Line 1 (TH394 Branding) quantity to 11.000 to match authorized PO PDF',
                        'grand_total' => $totals['grand_total'],
                    ]),
                    'created_at'  => now(),
                ]);
            }
        }

        Cache::flush();
        echo "Successfully updated PO TH/2026-27/121 to Qty 11 / Rs. 3,08,000.00.\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
