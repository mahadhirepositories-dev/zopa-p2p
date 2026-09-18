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
     * Remove Line Items 5, 6, and 7 from PO AV/2026-27/29 (Apollo Vidhyalayam):
     * - Line 5 (1226): Double Side Logo & School Name Size is 10 Feet to 7 inch
     * - Line 6 (1227): Front Glass Top Black Sticker Background Logo & School Name Size is 6 Feet to 9 inch
     * - Line 7 (1228): Bus Back Side School Name & Logo Adress, Email, Ph Number QR code-Total Size is 4 Feet to 2.5 Feet
     * - Re-sequence remaining items (1 to 4)
     * - Recalculate PO financial totals (net_total, tax_amount, grand_total, round_off)
     * - Update budget ledger freeze / consume amounts
     * - Adjust PR converted_qty and sync PR conversion status
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

        foreach ($pos as $po) {
            $poId = $po->id;

            // Find items 5, 6, 7 to delete
            $itemsToDelete = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->whereIn('sno', [5, 6, 7])
                      ->orWhereIn('product_code', ['1226', '1227', '1228'])
                      ->orWhere('description', 'LIKE', '%Double Side Logo%')
                      ->orWhere('description', 'LIKE', '%Front Glass Top Black Sticker%')
                      ->orWhere('description', 'LIKE', '%Bus Back Side School Name%');
                })
                ->get();

            // Adjust converted_qty on linked PR items if any
            foreach ($itemsToDelete as $delItem) {
                if (!empty($delItem->pr_item_id)) {
                    $prItem = DB::table('pr_items')->where('id', $delItem->pr_item_id)->first();
                    if ($prItem) {
                        $newConverted = max(0, (float) $prItem->converted_qty - (float) $delItem->qty);
                        DB::table('pr_items')->where('id', $delItem->pr_item_id)->update([
                            'converted_qty' => $newConverted,
                            'updated_at'    => now(),
                        ]);
                    }
                }
            }

            // Delete the 3 items
            $deleteIds = $itemsToDelete->pluck('id')->toArray();
            if (!empty($deleteIds)) {
                DB::table('po_items')->whereIn('id', $deleteIds)->delete();
            }

            // Fetch and re-sequence remaining items
            $remainingItems = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->orderBy('id')->get();
            $itemsArray = [];

            foreach ($remainingItems as $index => $item) {
                $newSno = $index + 1;
                $netRate   = (float) $item->net_rate;
                $gstRate   = (float) $item->gst_rate;
                $grossRate = round($netRate * (1 + $gstRate / 100), 2);
                $amount    = round($grossRate * (float) $item->qty, 2);

                DB::table('po_items')->where('id', $item->id)->update([
                    'sno'        => $newSno,
                    'gross_rate' => $grossRate,
                    'amount'     => $amount,
                    'updated_at' => now(),
                ]);

                $itemsArray[] = [
                    'net_rate' => $netRate,
                    'qty'      => (float) $item->qty,
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
                }
            }

            // Log activity
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $po->tenant_id ?: $avTenantId,
                    'entity_type' => 'PO',
                    'entity_id'   => $poId,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'line_items_removed',
                    'meta'        => json_encode([
                        'po_number'       => $po->po_number,
                        'removed_items'   => 'Lines 5, 6, and 7 removed (Codes 1226, 1227, 1228)',
                        'new_grand_total' => $totals['grand_total'],
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
