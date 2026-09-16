<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Total Health | BENCO AGENCIES PO (from PR45):
     * - Remove/replace line item 5 ("Weight & Height -SAMSO", rate 1650 + 18%)
     * - In that place add product TH375 (rate 1650 + 18%, qty 11)
     * - And add product TH376 (rate 400 + 18%, qty 11)
     * - Re-number Torch (was line 6) to line 7
     * - Recalculate financial totals:
     *     Net Total: 55,671.00
     *     Tax Amount: 5,955.29
     *     Round Off: -0.29
     *     Grand Total: 61,626.00
     * - Update Budget Ledger freeze amount to 61,626.00
     * - Update PR45 line items and totals to match
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

        // 2. Locate the BENCO AGENCIES PO
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($tenantId) {
                if ($tenantId) {
                    $q->where('tenant_id', $tenantId);
                }
            })
            ->where(function ($q) {
                $q->whereExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('vendors')
                        ->whereColumn('vendors.id', 'purchase_orders.vendor_id')
                        ->where('vendors.name', 'LIKE', '%BENCO%');
                })
                ->orWhere('pr_reference', 'LIKE', '%45%')
                ->orWhereExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('purchase_requisitions')
                        ->whereColumn('purchase_requisitions.id', 'purchase_orders.pr_id')
                        ->where('purchase_requisitions.pr_number', 'LIKE', '%45%');
                })
                ->orWhereExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('po_items')
                        ->whereColumn('po_items.po_id', 'purchase_orders.id')
                        ->where(function ($iq) {
                            $iq->where('description', 'LIKE', '%SAMSO%')
                              ->orWhere('description', 'LIKE', '%Weight & Height%')
                              ->orWhere('description', 'LIKE', '%Weight%Height%');
                        });
                });
            })
            ->get();

        if ($pos->isEmpty()) {
            $pos = DB::table('purchase_orders')
                ->whereExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('vendors')
                        ->whereColumn('vendors.id', 'purchase_orders.vendor_id')
                        ->where('vendors.name', 'LIKE', '%BENCO%');
                })
                ->get();
        }

        foreach ($pos as $po) {
            $poId = $po->id;
            $tId = $po->tenant_id;

            // Check if line 5 exists and has not already been split into TH375 & TH376
            $hasTh376Already = DB::table('po_items')
                ->where('po_id', $poId)
                ->where('product_code', 'TH376')
                ->exists();

            $line5 = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->where('description', 'LIKE', '%SAMSO%')
                      ->orWhere('description', 'LIKE', '%Weight & Height%')
                      ->orWhere('description', 'LIKE', '%Weight%Height%')
                      ->orWhere(function ($sub) {
                          $sub->where('sno', 5)
                              ->where('product_code', '!=', 'TH375');
                      });
                })
                ->first();

            if (!$line5 && $hasTh376Already) {
                $this->recalcTotals($po, $gstService);
                continue;
            }

            if (!$line5) {
                $line5 = DB::table('po_items')->where('po_id', $poId)->where('sno', 5)->first();
            }

            if (!$line5) {
                continue;
            }

            // 3. Find or Create Product TH375 (1650 + 18%)
            $prodTh375 = DB::table('products')
                ->where('tenant_id', $tId)
                ->where('code', 'TH375')
                ->first();

            if (!$prodTh375) {
                $th375Id = DB::table('products')->insertGetId([
                    'tenant_id'       => $tId,
                    'code'            => 'TH375',
                    'name'            => 'Weight Scale - SAMSO',
                    'description'     => 'Weight Scale - SAMSO',
                    'unit'            => $line5->unit ?: 'Nos',
                    'net_rate'        => 1650.00,
                    'gst_rate'        => 18.00,
                    'hsn_code'        => $line5->hsn_code ?: '8423',
                    'category_id'     => $line5->category_id ?? null,
                    'warranty_months' => $line5->warranty_months ?? 0,
                    'is_active'       => 1,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
                $prodTh375 = DB::table('products')->where('id', $th375Id)->first();
            } else {
                DB::table('products')->where('id', $prodTh375->id)->update([
                    'net_rate'   => 1650.00,
                    'gst_rate'   => 18.00,
                    'updated_at' => now(),
                ]);
            }

            // 4. Find or Create Product TH376 (400 + 18%)
            $prodTh376 = DB::table('products')
                ->where('tenant_id', $tId)
                ->where('code', 'TH376')
                ->first();

            if (!$prodTh376) {
                $th376Id = DB::table('products')->insertGetId([
                    'tenant_id'       => $tId,
                    'code'            => 'TH376',
                    'name'            => 'Height Scale - SAMSO',
                    'description'     => 'Height Scale - SAMSO',
                    'unit'            => $line5->unit ?: 'Nos',
                    'net_rate'        => 400.00,
                    'gst_rate'        => 18.00,
                    'hsn_code'        => $line5->hsn_code ?: '9017',
                    'category_id'     => $line5->category_id ?? null,
                    'warranty_months' => $line5->warranty_months ?? 0,
                    'is_active'       => 1,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
                $prodTh376 = DB::table('products')->where('id', $th376Id)->first();
            } else {
                DB::table('products')->where('id', $prodTh376->id)->update([
                    'net_rate'   => 400.00,
                    'gst_rate'   => 18.00,
                    'updated_at' => now(),
                ]);
            }

            // 5. Check and update Source Requisition (PR45)
            $pr = null;
            if ($po->pr_id) {
                $pr = DB::table('purchase_requisitions')->where('id', $po->pr_id)->first();
            }
            if (!$pr && !empty($po->pr_reference)) {
                $pr = DB::table('purchase_requisitions')
                    ->where('tenant_id', $tId)
                    ->where('pr_number', $po->pr_reference)
                    ->first();
            }
            if (!$pr) {
                $pr = DB::table('purchase_requisitions')
                    ->where('tenant_id', $tId)
                    ->where('pr_number', 'LIKE', '%45%')
                    ->first();
            }

            $prTh375ItemId = null;
            $prTh376ItemId = null;

            if ($pr) {
                $prItems = DB::table('pr_items')->where('pr_id', $pr->id)->orderBy('sno')->get();
                $prItem5 = $prItems->first(function ($it) use ($line5) {
                    return $it->id == ($line5->pr_item_id ?? null) ||
                           stripos($it->description, 'SAMSO') !== false ||
                           stripos($it->description, 'Weight') !== false ||
                           $it->sno == 5;
                });

                if ($prItem5) {
                    DB::table('pr_items')->where('id', $prItem5->id)->update([
                        'sno'             => 5,
                        'product_id'      => $prodTh375->id,
                        'description'     => $prodTh375->name ?: 'Weight Scale - SAMSO',
                        'qty'             => 11.000,
                        'converted_qty'   => 11.000,
                        'estimated_price' => 1650.00,
                        'unit'            => 'Nos',
                        'updated_at'      => now(),
                    ]);
                    $prTh375ItemId = $prItem5->id;

                    $existingPrTh376 = $prItems->first(function ($it) use ($prodTh376) {
                        return $it->product_id == $prodTh376->id || stripos($it->description, 'Height') !== false;
                    });

                    if ($existingPrTh376) {
                        DB::table('pr_items')->where('id', $existingPrTh376->id)->update([
                            'sno'             => 6,
                            'product_id'      => $prodTh376->id,
                            'description'     => $prodTh376->name ?: 'Height Scale - SAMSO',
                            'qty'             => 11.000,
                            'converted_qty'   => 11.000,
                            'estimated_price' => 400.00,
                            'unit'            => 'Nos',
                            'updated_at'      => now(),
                        ]);
                        $prTh376ItemId = $existingPrTh376->id;
                    } else {
                        DB::table('pr_items')
                            ->where('pr_id', $pr->id)
                            ->where('sno', '>=', 6)
                            ->where('id', '!=', $prItem5->id)
                            ->increment('sno');

                        $prTh376ItemId = DB::table('pr_items')->insertGetId([
                            'pr_id'            => $pr->id,
                            'sno'              => 6,
                            'product_id'       => $prodTh376->id,
                            'description'      => $prodTh376->name ?: 'Height Scale - SAMSO',
                            'category_id'      => $prItem5->category_id ?? null,
                            'qty'              => 11.000,
                            'converted_qty'    => 11.000,
                            'short_closed_qty' => 0,
                            'is_short_closed'  => 0,
                            'unit'             => 'Nos',
                            'estimated_price'  => 400.00,
                            'created_at'       => now(),
                            'updated_at'       => now(),
                        ]);
                    }

                    $prTotal = DB::table('pr_items')
                        ->where('pr_id', $pr->id)
                        ->selectRaw('SUM(qty * estimated_price) as total')
                        ->value('total');

                    DB::table('purchase_requisitions')->where('id', $pr->id)->update([
                        'estimated_amount' => $prTotal,
                        'status'           => 'converted',
                        'updated_at'       => now(),
                    ]);
                }
            }

            // 6. Update PO Line Item 5 to TH375
            $netRateTh375 = 1650.00;
            $gstRateTh375 = 18.00;
            $grossRateTh375 = round($netRateTh375 * (1 + $gstRateTh375 / 100), 2); // 1947.00
            $amountTh375 = round(11 * $grossRateTh375, 2); // 21417.00

            DB::table('po_items')->where('id', $line5->id)->update([
                'sno'             => 5,
                'pr_item_id'      => $prTh375ItemId ?? $line5->pr_item_id,
                'product_id'      => $prodTh375->id,
                'product_code'    => 'TH375',
                'product_name'    => $prodTh375->name ?: 'Weight Scale - SAMSO',
                'description'     => $prodTh375->name ?: 'Weight Scale - SAMSO',
                'category_id'     => $prodTh375->category_id ?? $line5->category_id,
                'hsn_code'        => $prodTh375->hsn_code ?: ($line5->hsn_code ?: '8423'),
                'unit'            => 'Nos',
                'qty'             => 11.000,
                'net_rate'        => $netRateTh375,
                'gst_rate'        => $gstRateTh375,
                'gross_rate'      => $grossRateTh375,
                'amount'          => $amountTh375,
                'warranty_months' => $line5->warranty_months ?? 0,
                'required_by'     => $line5->required_by,
                'updated_at'      => now(),
            ]);

            // 7. Shift any existing po_items with sno >= 6 (Torch from sno 6 to 7)
            DB::table('po_items')
                ->where('po_id', $poId)
                ->where('sno', '>=', 6)
                ->where('id', '!=', $line5->id)
                ->increment('sno');

            // 8. Insert new line item for TH376 (400 + 18%) as SNO 6
            $netRateTh376 = 400.00;
            $gstRateTh376 = 18.00;
            $grossRateTh376 = round($netRateTh376 * (1 + $gstRateTh376 / 100), 2); // 472.00
            $amountTh376 = round(11 * $grossRateTh376, 2); // 5192.00

            DB::table('po_items')->insert([
                'po_id'           => $poId,
                'sno'             => 6,
                'pr_item_id'      => $prTh376ItemId ?? null,
                'product_id'      => $prodTh376->id,
                'product_code'    => 'TH376',
                'product_name'    => $prodTh376->name ?: 'Height Scale - SAMSO',
                'description'     => $prodTh376->name ?: 'Height Scale - SAMSO',
                'category_id'     => $prodTh376->category_id ?? $line5->category_id,
                'hsn_code'        => $prodTh376->hsn_code ?: ($line5->hsn_code ?: '9017'),
                'unit'            => 'Nos',
                'qty'             => 11.000,
                'net_rate'        => $netRateTh376,
                'gst_rate'        => $gstRateTh376,
                'gross_rate'      => $grossRateTh376,
                'amount'          => $amountTh376,
                'warranty_months' => $line5->warranty_months ?? 0,
                'required_by'     => $line5->required_by,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);

            // 9. Re-sequence all items to guarantee 1, 2, 3, 4, 5, 6, 7
            $orderedItems = DB::table('po_items')
                ->where('po_id', $poId)
                ->orderBy('sno')
                ->orderBy('id')
                ->get();

            $seq = 1;
            foreach ($orderedItems as $oit) {
                DB::table('po_items')->where('id', $oit->id)->update(['sno' => $seq]);
                $seq++;
            }

            // 10. Recalculate PO Financial Totals and update Budget Ledger
            $this->recalcTotals($po, $gstService);
        }
    }

    private function recalcTotals($po, GstService $gstService): void
    {
        $poId = $po->id;
        $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();
        $vendorAddress = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
        $billToLocation = DB::table('locations')->where('id', $po->bill_to_location_id)->first();

        $vendorStateCode = $vendorAddress?->state_code ?? '36';
        $companyStateCode = $billToLocation?->state_code ?? '37';

        $itemsArray = [];
        foreach ($items as $it) {
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
            'tax_amount'  => $totals['tax_amount'],
            'grand_total' => $totals['grand_total'],
            'round_off'   => $totals['round_off'],
            'updated_at'  => now(),
        ]);

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

    public function down(): void
    {
    }
};
