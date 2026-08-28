<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Total Health | PO-107:
     * - Item Code TH527 - Product: Mefenamic acid + Paracetamol - Rate: 38/- (Quantity remains 50)
     * - Recalculate item amounts and PO totals (Net Total, Tax Amount, Grand Total, Round Off, Budget Ledger).
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // 1. Find Total Health tenant
        $tenant = DB::table('tenants')
            ->where('name', 'LIKE', '%Total Health%')
            ->orWhere('code', 'TH')
            ->first();

        // 2. Find PO-107
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($tenant) {
                if ($tenant) {
                    $q->where('tenant_id', $tenant->id);
                }
            })
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/107')
                  ->orWhere('po_number', 'TH-2026-27-107')
                  ->orWhere('po_number', 'TH2026-27/107')
                  ->orWhere('po_number', 'LIKE', '%107%')
                  ->orWhere('id', 107);
            })
            ->get();

        if ($pos->isEmpty()) {
            // Fallback: search across all tenants for PO with 107 and Mefenamic acid
            $pos = DB::table('purchase_orders')
                ->where('po_number', 'LIKE', '%107%')
                ->orWhereExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('po_items')
                        ->whereColumn('po_items.po_id', 'purchase_orders.id')
                        ->where(function ($iq) {
                            $iq->where('description', 'LIKE', '%Mefenamic%')
                              ->orWhere('product_code', 'TH132')
                              ->orWhere('product_code', 'TH527');
                        });
                })
                ->get();
        }

        foreach ($pos as $po) {
            $poId = $po->id;
            $tenantId = $po->tenant_id;

            // 3. Find or Create Product TH527 in products master
            $product = DB::table('products')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) {
                    $q->where('code', 'TH527')
                      ->orWhere('name', 'LIKE', '%Mefenamic acid + Paracetamol%')
                      ->orWhere('name', 'LIKE', '%Mefenamic Acid%Paracetamol%');
                })
                ->first();

            if (!$product) {
                // Check if TH132 exists to copy category / unit / hsn
                $oldProduct = DB::table('products')
                    ->where('tenant_id', $tenantId)
                    ->where('code', 'TH132')
                    ->first();

                $productId = DB::table('products')->insertGetId([
                    'tenant_id'       => $tenantId,
                    'code'            => 'TH527',
                    'name'            => 'Mefenamic Acid + Paracetamol Tablet',
                    'description'     => 'Mefenamic Acid + Paracetamol Tablet',
                    'unit'            => $oldProduct?->unit ?? 'Nos',
                    'hsn_code'        => $oldProduct?->hsn_code ?? '300490',
                    'category_id'     => $oldProduct?->category_id ?? null,
                    'subcategory_id'  => $oldProduct?->subcategory_id ?? null,
                    'net_rate'        => 38.00,
                    'gst_rate'        => 5.00,
                    'warranty_months' => 0,
                    'is_active'       => true,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
            } else {
                $productId = $product->id;
                DB::table('products')->where('id', $productId)->update([
                    'code'       => 'TH527',
                    'name'       => $product->name ?: 'Mefenamic Acid + Paracetamol Tablet',
                    'net_rate'   => 38.00,
                    'gst_rate'   => 5.00,
                    'updated_at' => now(),
                ]);
            }

            // 4. Update the PO Item on PO-107
            $targetItem = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('product_code', 'TH527')
                      ->orWhere('product_code', 'TH132')
                      ->orWhere('description', 'LIKE', '%Mefenamic%')
                      ->orWhere('sno', 99);
                })
                ->first();

            if ($targetItem) {
                $qty = (float)$targetItem->qty > 0 ? (float)$targetItem->qty : 50;
                $gstRate = 5.00; // 5% GST for medicine
                $netRate = 38.00;
                $grossRate = $netRate * (1 + $gstRate / 100); // 39.90
                $amount = round($grossRate * $qty, 2);        // 1995.00 (for qty 50)

                DB::table('po_items')->where('id', $targetItem->id)->update([
                    'product_id'   => $productId,
                    'product_code' => 'TH527',
                    'product_name' => 'Mefenamic Acid + Paracetamol Tablet',
                    'description'  => 'Mefenamic Acid + Paracetamol Tablet',
                    'hsn_code'     => $targetItem->hsn_code ?: '300490',
                    'net_rate'     => $netRate,
                    'gst_rate'     => $gstRate,
                    'gross_rate'   => $grossRate,
                    'amount'       => $amount,
                    'updated_at'   => now(),
                ]);
            }

            // 5. Recalculate all items and PO totals
            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();
            $vendorAddress = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation = DB::table('locations')->where('id', $po->bill_to_location_id)->first();

            $vendorStateCode = $vendorAddress?->state_code ?? '';
            $companyStateCode = $billToLocation?->state_code ?? '';

            $itemsArray = [];
            foreach ($items as $index => $item) {
                $sno = $index + 1;
                $gRate = (float)$item->net_rate * (1 + (float)$item->gst_rate / 100);
                $amt = round($gRate * (float)$item->qty, 2);

                DB::table('po_items')->where('id', $item->id)->update([
                    'sno'        => $sno,
                    'gross_rate' => $gRate,
                    'amount'     => $amt,
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
                'updated_at'  => now(),
            ]);

            // 6. Update Budget Ledger if present
            if (DB::getSchemaBuilder()->hasTable('budget_ledger')) {
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
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
