<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Force Update PO-107 and Item TH527 for Total Health:
     * - Item code: TH527
     * - Product: Mefenamic acid + Paracetamol (Mefenamic Acid + Paracetamol Tablet)
     * - Net rate: 38.00
     * - Recalculate item amounts (Gross: 39.90, Total: 1995.00 for qty 50) and PO totals.
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // 1. Ensure Product TH527 exists in all tenants or specifically Total Health
        $tenants = DB::table('tenants')->get();
        foreach ($tenants as $tenant) {
            $existingTh527 = DB::table('products')
                ->where('tenant_id', $tenant->id)
                ->where(function ($q) {
                    $q->where('code', 'TH527')
                      ->orWhere('name', 'LIKE', '%Mefenamic%Paracetamol%')
                      ->orWhere('name', 'LIKE', '%Mefenamic acid + Paracetamol%');
                })
                ->first();

            $oldTh132 = DB::table('products')
                ->where('tenant_id', $tenant->id)
                ->where('code', 'TH132')
                ->first();

            if (!$existingTh527) {
                DB::table('products')->insert([
                    'tenant_id'       => $tenant->id,
                    'code'            => 'TH527',
                    'name'            => 'Mefenamic Acid + Paracetamol Tablet',
                    'description'     => 'Mefenamic Acid + Paracetamol Tablet',
                    'unit'            => $oldTh132?->unit ?? 'Nos',
                    'hsn_code'        => $oldTh132?->hsn_code ?? '300490',
                    'category_id'     => $oldTh132?->category_id ?? null,
                    'subcategory_id'  => $oldTh132?->subcategory_id ?? null,
                    'net_rate'        => 38.00,
                    'gst_rate'        => 5.00,
                    'warranty_months' => 0,
                    'is_active'       => true,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
            } else {
                DB::table('products')->where('id', $existingTh527->id)->update([
                    'code'       => 'TH527',
                    'name'       => 'Mefenamic Acid + Paracetamol Tablet',
                    'net_rate'   => 38.00,
                    'gst_rate'   => 5.00,
                    'updated_at' => now(),
                ]);
            }
        }

        // 2. Find and update ALL matching po_items across the entire database
        $affectedPoIds = [];

        $matchingItems = DB::table('po_items')
            ->where(function ($q) {
                $q->where('product_code', 'TH132')
                  ->orWhere('product_code', 'TH527')
                  ->orWhere('description', 'LIKE', '%Mefenamic%')
                  ->orWhere('description', 'LIKE', '%Dicyclomine%');
            })
            ->get();

        foreach ($matchingItems as $item) {
            $po = DB::table('purchase_orders')->where('id', $item->po_id)->first();
            $tenantId = $po?->tenant_id ?? 1;

            $product = DB::table('products')
                ->where('tenant_id', $tenantId)
                ->where('code', 'TH527')
                ->first();

            $qty = (float)$item->qty > 0 ? (float)$item->qty : 50;
            $netRate = 38.00;
            $gstRate = 5.00;
            $grossRate = $netRate * (1 + $gstRate / 100); // 39.90
            $amount = round($grossRate * $qty, 2);        // 1995.00 for qty 50

            DB::table('po_items')->where('id', $item->id)->update([
                'product_id'   => $product?->id ?? $item->product_id,
                'product_code' => 'TH527',
                'product_name' => 'Mefenamic Acid + Paracetamol Tablet',
                'description'  => 'Mefenamic Acid + Paracetamol Tablet',
                'hsn_code'     => $item->hsn_code ?: '300490',
                'unit'         => $item->unit ?: 'Nos',
                'qty'          => $qty,
                'net_rate'     => $netRate,
                'gst_rate'     => $gstRate,
                'gross_rate'   => $grossRate,
                'amount'       => $amount,
                'updated_at'   => now(),
            ]);

            $affectedPoIds[$item->po_id] = true;
        }

        // Also check any PO matching 107
        $pos107 = DB::table('purchase_orders')
            ->where('po_number', 'LIKE', '%107%')
            ->orWhere('id', 107)
            ->pluck('id');

        foreach ($pos107 as $pId) {
            $affectedPoIds[$pId] = true;

            // Check if there is an item with sno = 99 on this PO
            $item99 = DB::table('po_items')->where('po_id', $pId)->where('sno', 99)->first();
            if ($item99) {
                $po = DB::table('purchase_orders')->where('id', $pId)->first();
                $tenantId = $po?->tenant_id ?? 1;
                $product = DB::table('products')->where('tenant_id', $tenantId)->where('code', 'TH527')->first();

                $qty = (float)$item99->qty > 0 ? (float)$item99->qty : 50;
                $netRate = 38.00;
                $gstRate = 5.00;
                $grossRate = $netRate * (1 + $gstRate / 100);
                $amount = round($grossRate * $qty, 2);

                DB::table('po_items')->where('id', $item99->id)->update([
                    'product_id'   => $product?->id ?? $item99->product_id,
                    'product_code' => 'TH527',
                    'product_name' => 'Mefenamic Acid + Paracetamol Tablet',
                    'description'  => 'Mefenamic Acid + Paracetamol Tablet',
                    'hsn_code'     => $item99->hsn_code ?: '300490',
                    'unit'         => $item99->unit ?: 'Nos',
                    'qty'          => $qty,
                    'net_rate'     => $netRate,
                    'gst_rate'     => $gstRate,
                    'gross_rate'   => $grossRate,
                    'amount'       => $amount,
                    'updated_at'   => now(),
                ]);
            }
        }

        // 3. Update pr_items as well if any exist
        $prItems = DB::table('pr_items')
            ->where(function ($q) {
                $q->where('description', 'LIKE', '%Mefenamic%')
                  ->orWhere('description', 'LIKE', '%Dicyclomine%');
            })
            ->get();

        foreach ($prItems as $pri) {
            $pr = DB::table('purchase_requisitions')->where('id', $pri->pr_id)->first();
            $tenantId = $pr?->tenant_id ?? 1;
            $prod = DB::table('products')->where('tenant_id', $tenantId)->where('code', 'TH527')->first();

            DB::table('pr_items')->where('id', $pri->id)->update([
                'product_id'      => $prod?->id ?? $pri->product_id,
                'description'     => 'Mefenamic Acid + Paracetamol Tablet',
                'estimated_price' => 38.00,
                'updated_at'      => now(),
            ]);
        }

        // 4. Recalculate totals for all affected POs
        foreach (array_keys($affectedPoIds) as $poId) {
            $po = DB::table('purchase_orders')->where('id', $poId)->first();
            if (!$po) continue;

            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();
            if ($items->isEmpty()) continue;

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

            // Update Budget Ledger if present
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

        Cache::flush();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
