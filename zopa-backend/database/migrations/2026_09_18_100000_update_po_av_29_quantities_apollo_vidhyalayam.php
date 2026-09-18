<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Services\GstService;
use App\Models\PurchaseRequisition;

return new class extends Migration
{
    /**
     * Update PO AV/2026-27/29 for Apollo Vidhyalayam:
     * - Line items 1 to 3: Qty = 7
     * - Line item 4: Qty = 6
     * - Recalculate line item amounts, PO financial totals, tax, and round-off
     * - Update budget ledger freeze/consume amounts
     * - Sync linked PR items, estimated totals, and conversion statuses
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // 1. Resolve Apollo Vidhyalayam Tenant
        $avTenant = DB::table('tenants')
            ->where('id', 7)
            ->orWhere('name', 'LIKE', '%Apollo%Vidhyalayam%')
            ->orWhere('code', 'LIKE', '%APOLLO%')
            ->first();

        $avTenantId = $avTenant?->id ?? 7;

        Log::info("Running update for PO AV/2026-27/29. Resolved AV Tenant ID: {$avTenantId}");

        // 2. Find target Purchase Order AV/2026-27/29
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($avTenantId) {
                $q->where('po_number', 'AV/2026-27/29')
                  ->orWhere('po_number', 'LIKE', '%AV%2026-27/29%')
                  ->orWhere('po_number', 'LIKE', '%AV/2026-27/29%')
                  ->orWhere('po_number', 'LIKE', '%2026-27/29%')
                  ->orWhere(function ($sub) use ($avTenantId) {
                      $sub->where('tenant_id', $avTenantId)
                          ->where(function ($s) {
                              $s->where('po_number', 'LIKE', '%29%')
                                ->orWhere('po_number', '29')
                                ->orWhere('id', 29);
                          });
                  });
            })
            ->get();

        Log::info("Found " . $pos->count() . " purchase order(s) matching AV/2026-27/29");

        foreach ($pos as $po) {
            $poId = $po->id;
            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->orderBy('id')->get();
            Log::info("Processing PO ID {$poId} ({$po->po_number}) with " . $items->count() . " items.");

            $itemsArray = [];
            foreach ($items as $index => $item) {
                $sno = $item->sno ?: ($index + 1);

                if ($sno >= 1 && $sno <= 3) {
                    $newQty = 7.00;
                } elseif ($sno == 4) {
                    $newQty = 6.00;
                } else {
                    $newQty = (float) $item->qty;
                }

                $netRate   = (float) $item->net_rate;
                $gstRate   = (float) $item->gst_rate;
                $grossRate = round($netRate * (1 + $gstRate / 100), 2);
                $amount    = round($grossRate * $newQty, 2);

                DB::table('po_items')->where('id', $item->id)->update([
                    'sno'        => $sno,
                    'qty'        => $newQty,
                    'gross_rate' => $grossRate,
                    'amount'     => $amount,
                    'updated_at' => now(),
                ]);

                Log::info("  -> Line {$sno} ({$item->product_name}): Qty updated from {$item->qty} to {$newQty}, Amount: {$amount}");

                // Sync linked PR item if attached
                if (!empty($item->pr_item_id)) {
                    $prItem = DB::table('pr_items')->where('id', $item->pr_item_id)->first();
                    if ($prItem) {
                        DB::table('pr_items')->where('id', $item->pr_item_id)->update([
                            'qty'           => $newQty,
                            'converted_qty' => $newQty,
                            'updated_at'    => now(),
                        ]);
                    }
                }

                $itemsArray[] = [
                    'net_rate' => $netRate,
                    'qty'      => $newQty,
                    'gst_rate' => $gstRate,
                ];
            }

            // Recalculate PO Financial Totals
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

            Log::info("PO {$po->po_number} totals updated: Net: {$totals['net_total']}, Tax: {$totals['tax_amount']}, Grand Total: {$totals['grand_total']}");

            // Update Budget Ledger Freeze & Consume amounts
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

            // Sync linked PRs and their conversion status
            $linkedPrIds = [];
            if (!empty($po->pr_id)) {
                $linkedPrIds[] = $po->pr_id;
            }
            if (Schema::hasTable('po_prs')) {
                $pivotPrIds = DB::table('po_prs')->where('po_id', $poId)->pluck('pr_id')->toArray();
                $linkedPrIds = array_unique(array_merge($linkedPrIds, $pivotPrIds));
            }

            foreach ($linkedPrIds as $prId) {
                $prModel = PurchaseRequisition::find($prId);
                if ($prModel) {
                    $newPrEst = DB::table('pr_items')
                        ->where('pr_id', $prId)
                        ->where('is_short_closed', false)
                        ->selectRaw('SUM(qty * estimated_price) as total')
                        ->value('total') ?? 0;

                    DB::table('purchase_requisitions')->where('id', $prId)->update([
                        'estimated_amount' => round($newPrEst, 2),
                        'updated_at'       => now(),
                    ]);

                    PurchaseRequisition::syncPrConversion($prModel);
                    Log::info("  -> Linked PR {$prModel->pr_number} updated: estimated_amount = {$newPrEst}, status = {$prModel->fresh()->status}");
                }
            }

            // Log activity
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $po->tenant_id ?: $avTenantId,
                    'entity_type' => 'PO',
                    'entity_id'   => $poId,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'quantities_updated',
                    'meta'        => json_encode([
                        'po_number'   => $po->po_number,
                        'description' => 'Updated quantities: Items 1 to 3 set to 7, Item 4 set to 6',
                        'grand_total' => $totals['grand_total'],
                    ]),
                    'created_at'  => now(),
                ]);
            }
        }

        // 3. In case AV/2026-27/29 is also or alternatively referenced as a Purchase Requisition
        $prs = DB::table('purchase_requisitions')
            ->where(function ($q) use ($avTenantId) {
                $q->where('pr_number', 'AV/2026-27/29')
                  ->orWhere('pr_number', 'LIKE', '%AV%2026-27/29%')
                  ->orWhere(function ($sub) use ($avTenantId) {
                      $sub->where('tenant_id', $avTenantId)
                          ->where(function ($s) {
                              $s->where('pr_number', 'LIKE', '%29%')
                                ->orWhere('pr_number', '29')
                                ->orWhere('id', 29);
                          });
                  });
            })
            ->get();

        foreach ($prs as $pr) {
            $prItems = DB::table('pr_items')->where('pr_id', $pr->id)->orderBy('sno')->orderBy('id')->get();
            $prUpdated = false;

            foreach ($prItems as $idx => $it) {
                $sno = $it->sno ?: ($idx + 1);
                if ($sno >= 1 && $sno <= 3) {
                    $newQty = 7.00;
                } elseif ($sno == 4) {
                    $newQty = 6.00;
                } else {
                    continue;
                }

                DB::table('pr_items')->where('id', $it->id)->update([
                    'qty'        => $newQty,
                    'updated_at' => now(),
                ]);
                $prUpdated = true;
            }

            if ($prUpdated) {
                $prModel = PurchaseRequisition::find($pr->id);
                if ($prModel) {
                    $newPrEst = DB::table('pr_items')
                        ->where('pr_id', $pr->id)
                        ->where('is_short_closed', false)
                        ->selectRaw('SUM(qty * estimated_price) as total')
                        ->value('total') ?? 0;

                    DB::table('purchase_requisitions')->where('id', $pr->id)->update([
                        'estimated_amount' => round($newPrEst, 2),
                        'updated_at'       => now(),
                    ]);

                    PurchaseRequisition::syncPrConversion($prModel);
                    Log::info("PR {$pr->pr_number} quantities updated (Items 1-3: 7, Item 4: 6). New estimated total: {$newPrEst}");
                }
            }
        }

        Cache::flush();
    }

    public function down(): void
    {
    }
};
