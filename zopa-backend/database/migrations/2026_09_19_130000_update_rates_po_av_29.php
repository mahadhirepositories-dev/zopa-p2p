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
     * Update Line Item 1 and Line Item 2 rates, adjust freight, and set grand total
     * to exactly ₹42,918.00 for PO AV/2026-27/29 (Apollo Vidhyalayam):
     * - Line 1 (1222): Qty 7, Net Rate 2,100.00, GST 18%, Gross Rate 2,478.00 -> Amount 17,346.00
     * - Line 2 (1223): Qty 7, Net Rate 1,400.00, GST 18%, Gross Rate 1,652.00 -> Amount 11,564.00
     * - Line 3 (1224): Qty 7, Net Rate 800.00, GST 18%, Gross Rate 944.00 -> Amount 6,608.00
     * - Line 4 (1225): Qty 6, Net Rate 1,200.00, GST 0%, Gross Rate 1,200.00 -> Amount 7,200.00
     * - Items Net: 37,300.00 | Items Tax: 5,418.00 (CGST 2,709.00, SGST 2,709.00) | Items Gross: 42,718.00
     * - Freight: 200.00 (0% GST)
     * - Grand Total: 42,918.00 (Forty Two Thousand Nine Hundred Eighteen Rupees Only)
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

        $specs = [
            [
                'sno'          => 1,
                'code'         => '1222',
                'name'         => 'Double Side Logo & School Name Size is 12 Feet to 10 inch',
                'description'  => 'Double Side Logo & School Name Size is 12 Feet to 10 inch',
                'unit'         => 'Nos',
                'qty'          => 7.00,
                'net_rate'     => 2100.00,
                'gst_rate'     => 18.00,
                'gross_rate'   => 2478.00,
                'amount'       => 17346.00,
                'required_by'  => '2026-09-21',
            ],
            [
                'sno'          => 2,
                'code'         => '1223',
                'name'         => 'Front Glass Top Black Sticker Background Logo & School Name Size is . 7.5 Feet to 11inch',
                'description'  => 'Front Glass Top Black Sticker Background Logo & School Name Size is . 7.5 Feet to 11inch',
                'unit'         => 'Nos',
                'qty'          => 7.00,
                'net_rate'     => 1400.00,
                'gst_rate'     => 18.00,
                'gross_rate'   => 1652.00,
                'amount'       => 11564.00,
                'required_by'  => '2026-09-21',
            ],
            [
                'sno'          => 3,
                'code'         => '1224',
                'name'         => 'Bus Back Side School Name & Logo Adress, Email, Ph Number QR code-Total Size is 5 Feet to 2.5 Feet',
                'description'  => 'Bus Back Side School Name & Logo Adress, Email, Ph Number QR code-Total Size is 5 Feet to 2.5 Feet',
                'unit'         => 'Nos',
                'qty'          => 7.00,
                'net_rate'     => 800.00,
                'gst_rate'     => 18.00,
                'gross_rate'   => 944.00,
                'amount'       => 6608.00,
                'required_by'  => '2026-09-21',
            ],
            [
                'sno'          => 4,
                'code'         => '1225',
                'name'         => 'Bus Total Old Sticker Remove Labour Charges',
                'description'  => 'Bus Total Old Sticker Remove Labour Charges',
                'unit'         => 'Nos',
                'qty'          => 6.00,
                'net_rate'     => 1200.00,
                'gst_rate'     => 0.00,
                'gross_rate'   => 1200.00,
                'amount'       => 7200.00,
                'required_by'  => '2026-09-21',
            ],
        ];

        foreach ($pos as $po) {
            $poId = $po->id;

            // Find existing products map
            $products = DB::table('products')
                ->whereIn('code', ['1222', '1223', '1224', '1225'])
                ->get()
                ->keyBy('code');

            // Find PR items map if linked to PR
            $prItemsMap = [];
            $linkedPrId = $po->pr_id;
            if ($linkedPrId) {
                $prItems = DB::table('pr_items')->where('pr_id', $linkedPrId)->get();
                foreach ($prItems as $pri) {
                    if ($pri->sno) {
                        $prItemsMap[$pri->sno] = $pri->id;
                    }
                }
            }

            // Cleanly replace items on this PO
            DB::table('po_items')->where('po_id', $poId)->delete();

            $now = now();
            $itemsArray = [];

            foreach ($specs as $spec) {
                $product = $products->get($spec['code']);
                $productId = $product?->id;
                $prItemId = $prItemsMap[$spec['sno']] ?? null;

                DB::table('po_items')->insert([
                    'po_id'           => $poId,
                    'sno'             => $spec['sno'],
                    'pr_item_id'      => $prItemId,
                    'product_id'      => $productId,
                    'product_code'    => $spec['code'],
                    'product_name'    => $spec['name'],
                    'hsn_code'        => $product?->hsn_code,
                    'description'     => $spec['description'],
                    'category_id'     => $product?->category_id,
                    'qty'             => $spec['qty'],
                    'unit'            => $spec['unit'],
                    'net_rate'        => $spec['net_rate'],
                    'gst_rate'        => $spec['gst_rate'],
                    'gross_rate'      => $spec['gross_rate'],
                    'amount'          => $spec['amount'],
                    'required_by'     => $spec['required_by'],
                    'warranty_months' => 0,
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ]);

                if ($prItemId) {
                    DB::table('pr_items')->where('id', $prItemId)->update([
                        'qty'           => $spec['qty'],
                        'converted_qty' => $spec['qty'],
                        'updated_at'    => $now,
                    ]);
                }

                $itemsArray[] = [
                    'net_rate' => $spec['net_rate'],
                    'qty'      => $spec['qty'],
                    'gst_rate' => $spec['gst_rate'],
                ];
            }

            // Recalculate PO Financial Totals
            $vendorAddress   = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation  = DB::table('locations')->where('id', $po->bill_to_location_id)->first();
            $vendorStateCode = $vendorAddress?->state_code ?? '';
            $companyStateCode = $billToLocation?->state_code ?? '';
            $freight = 200.00;

            $totals = $gstService->calculatePoTotals(
                $itemsArray,
                $freight,
                $vendorStateCode,
                $companyStateCode,
                0.00,
                0.00
            );

            DB::table('purchase_orders')->where('id', $poId)->update([
                'net_total'        => $totals['net_total'],
                'freight'          => $totals['freight'],
                'freight_gst_rate' => 0.00,
                'tax_amount'       => $totals['tax_amount'],
                'discount'         => 0.00,
                'grand_total'      => $totals['grand_total'],
                'round_off'        => $totals['round_off'],
                'updated_at'       => now(),
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

            // Sync linked PR
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

            // Activity Log
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $po->tenant_id ?: $avTenantId,
                    'entity_type' => 'PO',
                    'entity_id'   => $poId,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'rates_updated',
                    'meta'        => json_encode([
                        'po_number'   => $po->po_number,
                        'description' => 'Updated item 1 rate to 2100, item 2 rate to 1400, freight to 200, grand total 42918',
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
