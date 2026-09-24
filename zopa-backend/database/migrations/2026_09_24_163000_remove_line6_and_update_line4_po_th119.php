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
     * Total Health | PO TH/2026-27/119 (BENCO AGENCIES, PR45):
     * 1. Remove Line Item 6 (TH376 Height Measurement, qty 11, rate 400 + 18% GST).
     * 2. Update Line Item 4 (TH374) to "Digital BP Apparatus" per updated product master.
     * 3. Re-sequence Torch (TH537) from S.No 7 to S.No 6.
     * 4. Recalculate PO Financial Totals:
     *    - Net Total: 51,271.00
     *    - Tax Amount: 5,163.29 (IGST)
     *    - Round Off: -0.29
     *    - Grand Total: 56,434.00
     * 5. Update Budget Ledger freeze & consume amounts to 56,434.00.
     * 6. Sync linked PR45 requisition items and conversion status.
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // 1. Locate Total Health tenant
        $tenant = DB::table('tenants')
            ->where('name', 'LIKE', '%Total Health%')
            ->orWhere('name', 'LIKE', '%TOTAL HEALTH%')
            ->first();

        $tenantId = $tenant?->id;

        // 2. Locate target PO TH/2026-27/119
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($tenantId) {
                if ($tenantId) {
                    $q->where('tenant_id', $tenantId);
                }
            })
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/119')
                  ->orWhere('po_number', 'LIKE', '%TH%119%')
                  ->orWhere('po_number', 'LIKE', '%2026-27/119%')
                  ->orWhere('po_number', '119')
                  ->orWhereExists(function ($sub) {
                      $sub->select(DB::raw(1))
                          ->from('vendors')
                          ->whereColumn('vendors.id', 'purchase_orders.vendor_id')
                          ->where('vendors.name', 'LIKE', '%BENCO%');
                  });
            })
            ->get();

        foreach ($pos as $po) {
            $poId = $po->id;
            $tId = $po->tenant_id ?: $tenantId;

            // ── PART A: Ensure Product Master TH374 is "Digital BP Apparatus" ──
            $prodTh374 = DB::table('products')
                ->where('code', 'TH374')
                ->when($tId, fn ($q) => $q->where('tenant_id', $tId))
                ->first();

            $targetName = 'Digital BP Apparatus';
            if ($prodTh374 && !empty($prodTh374->name) && stripos($prodTh374->name, 'Digital') !== false) {
                $targetName = $prodTh374->name;
            } elseif ($prodTh374) {
                DB::table('products')->where('id', $prodTh374->id)->update([
                    'name'        => 'Digital BP Apparatus',
                    'description' => 'Digital BP Apparatus',
                    'updated_at'  => now(),
                ]);
            }

            // ── PART B: Update Line Item 4 (TH374) on the PO ──
            $line4 = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('product_code', 'TH374')
                      ->orWhere('sno', 4)
                      ->orWhere('description', 'LIKE', '%BP Apparatus%');
                })
                ->first();

            if ($line4) {
                DB::table('po_items')->where('id', $line4->id)->update([
                    'product_name' => $targetName,
                    'description'  => $targetName,
                    'updated_at'   => now(),
                ]);

                if (!empty($line4->pr_item_id)) {
                    DB::table('pr_items')->where('id', $line4->pr_item_id)->update([
                        'description' => $targetName,
                        'updated_at'  => now(),
                    ]);
                }
            }

            // ── PART C: Remove Line Item 6 (TH376 Height Measurement) ──
            $line6 = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('product_code', 'TH376')
                      ->orWhere(function ($sub) {
                          $sub->where('sno', 6)
                              ->where('description', 'LIKE', '%Height%');
                      });
                })
                ->first();

            if ($line6) {
                if (!empty($line6->pr_item_id)) {
                    DB::table('pr_items')->where('id', $line6->pr_item_id)->update([
                        'converted_qty'    => 0,
                        'short_closed_qty' => $line6->qty,
                        'is_short_closed'  => true,
                        'updated_at'       => now(),
                    ]);
                }

                DB::table('po_items')->where('id', $line6->id)->delete();
            }

            // ── PART D: Re-sequence Remaining Items (1 to 6) ──
            $remainingItems = DB::table('po_items')
                ->where('po_id', $poId)
                ->orderBy('sno')
                ->orderBy('id')
                ->get();

            $seq = 1;
            foreach ($remainingItems as $item) {
                DB::table('po_items')->where('id', $item->id)->update([
                    'sno'        => $seq,
                    'updated_at' => now(),
                ]);
                $seq++;
            }

            // ── PART E: Recalculate Financial Totals ──
            $finalItems = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();
            $vendorAddress   = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation  = DB::table('locations')->where('id', $po->bill_to_location_id)->first();
            $vendorStateCode = $vendorAddress?->state_code ?? '36';
            $companyStateCode = $billToLocation?->state_code ?? '37';

            $itemsArray = [];
            foreach ($finalItems as $it) {
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

            // ── PART F: Update Budget Ledger Freeze & Consume ──
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

            // ── PART G: Sync Linked Requisition (PR45) ──
            $linkedPrId = $po->pr_id;
            if (!$linkedPrId && !empty($po->pr_reference)) {
                $linkedPrId = DB::table('purchase_requisitions')
                    ->where('tenant_id', $tId)
                    ->where('pr_number', $po->pr_reference)
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

            // ── PART H: Activity Log ──
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $tId,
                    'entity_type' => 'PO',
                    'entity_id'   => $poId,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'line_items_modified',
                    'meta'        => json_encode([
                        'po_number'   => $po->po_number,
                        'description' => 'Removed line 6 (TH376 Height Measurement), updated line 4 to Digital BP Apparatus, renumbered Torch to line 6, grand total updated to 56434.00',
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
