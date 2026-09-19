<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;
use Illuminate\Console\Command;

class UpdatePrQuantities extends Command
{
    protected $signature = 'pr:update-quantities';
    protected $description = 'Update PR line items with Short Close status or updated quantities for Total Health organization';

    public function handle(): int
    {
        $tenant = Tenant::where('name', 'like', '%Total Health%')
            ->orWhere('code', 'like', '%TH%')
            ->orWhere('code', 'like', '%TOTAL%')
            ->first();

        if (!$tenant) {
            $tenant = Tenant::first();
            $this->warn("Total Health tenant not found by name, falling back to Tenant ID: {$tenant->id} ({$tenant->name})");
        } else {
            $this->info("Found Tenant: {$tenant->name} (ID: {$tenant->id})");
        }

        // Structure:
        // [sno => ['action' => 'update_qty', 'qty' => X]]
        // OR [sno => ['action' => 'short_close', 'short_qty' => X, 'restore_qty' => Y (optional)]]
        $updates = [
            'PR3' => [
                11 => ['action' => 'short_close', 'short_qty' => 100, 'restore_qty' => 2500],
                16 => ['action' => 'short_close', 'short_qty' => 100, 'restore_qty' => 300],
                21 => ['action' => 'short_close', 'short_qty' => 100, 'restore_qty' => 100],
            ],
            'PR7' => [
                18 => ['action' => 'short_close', 'short_qty' => 600],
                30 => ['action' => 'short_close', 'short_qty' => 300],
                66 => ['action' => 'short_close', 'short_qty' => 30],
                68 => ['action' => 'short_close', 'short_qty' => 100],
            ],
            'PR8' => [
                1 => ['action' => 'update_qty', 'qty' => 12000],
                17 => ['action' => 'short_close', 'short_qty' => 600],
            ],
            'PR9' => [
                4 => ['action' => 'short_close', 'short_qty' => 12],
                5 => ['action' => 'short_close', 'short_qty' => 6],
                6 => ['action' => 'short_close', 'short_qty' => 3],
                7 => ['action' => 'short_close', 'short_qty' => 3],
                8 => ['action' => 'short_close', 'short_qty' => 3],
            ],
            'PR10' => [
                1 => ['action' => 'update_qty', 'qty' => 18],
                3 => ['action' => 'update_qty', 'qty' => 4],
                4 => ['action' => 'update_qty', 'qty' => 9],
                6 => ['action' => 'update_qty', 'qty' => 9],
                8 => ['action' => 'update_qty', 'qty' => 18],
                9 => ['action' => 'update_qty', 'qty' => 36],
                10 => ['action' => 'update_qty', 'qty' => 4],
                11 => ['action' => 'update_qty', 'qty' => 27],
                13 => ['action' => 'update_qty', 'qty' => 4],
                14 => ['action' => 'update_qty', 'qty' => 4],
                15 => ['action' => 'update_qty', 'qty' => 9],
                16 => ['action' => 'update_qty', 'qty' => 9],
                17 => ['action' => 'update_qty', 'qty' => 9],
            ],
            'PR12' => [
                1 => ['action' => 'update_qty', 'qty' => 300],
            ],
            'PR18' => [
                1 => ['action' => 'update_qty', 'qty' => 11],
                2 => ['action' => 'update_qty', 'qty' => 5],
                3 => ['action' => 'update_qty', 'qty' => 3],
                4 => ['action' => 'update_qty', 'qty' => 20],
                5 => ['action' => 'update_qty', 'qty' => 6],
                6 => ['action' => 'update_qty', 'qty' => 6],
                7 => ['action' => 'update_qty', 'qty' => 5],
                14 => ['action' => 'update_qty', 'qty' => 8],
                15 => ['action' => 'update_qty', 'qty' => 12],
            ],
            'PR19' => [
                1 => ['action' => 'update_qty', 'qty' => 5],
                2 => ['action' => 'update_qty', 'qty' => 24],
                3 => ['action' => 'update_qty', 'qty' => 45],
                4 => ['action' => 'update_qty', 'qty' => 25],
                5 => ['action' => 'update_qty', 'qty' => 27],
                6 => ['action' => 'update_qty', 'qty' => 21],
                7 => ['action' => 'update_qty', 'qty' => 8],
                8 => ['action' => 'update_qty', 'qty' => 16],
                9 => ['action' => 'update_qty', 'qty' => 45],
                10 => ['action' => 'update_qty', 'qty' => 55],
                11 => ['action' => 'update_qty', 'qty' => 2],
                12 => ['action' => 'update_qty', 'qty' => 10],
            ],
            'PR20' => [
                19 => ['action' => 'short_close', 'short_qty' => 200],
            ],
            'PR22' => [
                3 => ['action' => 'short_close', 'short_qty' => 3, 'restore_qty' => 6],
                7 => ['action' => 'short_close', 'short_qty' => 1],
                8 => ['action' => 'short_close', 'short_qty' => 1],
            ],
            'PR32' => [
                1 => ['action' => 'update_qty', 'qty' => 1],
                2 => ['action' => 'update_qty', 'qty' => 1],
                3 => ['action' => 'update_qty', 'qty' => 4],
                4 => ['action' => 'update_qty', 'qty' => 1],
                5 => ['action' => 'update_qty', 'qty' => 1],
                6 => ['action' => 'update_qty', 'qty' => 1],
                7 => ['action' => 'update_qty', 'qty' => 2],
                8 => ['action' => 'update_qty', 'qty' => 3],
                10 => ['action' => 'update_qty', 'qty' => 1],
                12 => ['action' => 'update_qty', 'qty' => 1],
            ],
            'PR36' => [
                56 => ['action' => 'update_qty', 'qty' => 1],
                69 => ['action' => 'update_qty', 'qty' => 50],
                75 => ['action' => 'update_qty', 'qty' => 10],
            ],
            'PR40' => [
                6 => ['action' => 'short_close', 'short_qty' => 1800, 'desc' => 'PAIN RELIFE'],
                8 => ['action' => 'short_close', 'short_qty' => 2000, 'desc' => 'CETRIZINE'],
                42 => ['action' => 'short_close', 'short_qty' => 5, 'desc' => 'AVIL'],
                50 => ['action' => 'short_close', 'short_qty' => 1000, 'desc' => 'OKASET', 'alt_sno' => 1000],
                59 => ['action' => 'short_close', 'short_qty' => 600, 'desc' => 'OKASET', 'alt_sno' => 600],
            ],
        ];

        $updatedPrCount = 0;
        $updatedItemCount = 0;

        foreach ($updates as $prNumber => $itemsToUpdate) {
            $altNumber = str_replace('PR', 'PR-', $prNumber);
            $pr = PurchaseRequisition::where('tenant_id', $tenant->id)
                ->where(function ($q) use ($prNumber, $altNumber) {
                    $q->where('pr_number', $prNumber)
                      ->orWhere('pr_number', $altNumber)
                      ->orWhere('pr_ref', $prNumber)
                      ->orWhere('pr_ref', $altNumber);
                })
                ->with('items')
                ->first();

            if (!$pr) {
                $pr = PurchaseRequisition::where('pr_number', $prNumber)
                    ->orWhere('pr_number', $altNumber)
                    ->orWhere('pr_ref', $prNumber)
                    ->orWhere('pr_ref', $altNumber)
                    ->with('items')
                    ->first();
            }

            if (!$pr) {
                $this->error("PR {$prNumber} not found!");
                continue;
            }

            $this->info("Processing PR: {$pr->pr_number} (ID: {$pr->id})");
            $prModified = false;

            foreach ($itemsToUpdate as $sno => $cfg) {
                $item = $pr->items->firstWhere('sno', $sno);
                if (!$item && isset($cfg['alt_sno'])) {
                    $item = $pr->items->firstWhere('sno', $cfg['alt_sno']);
                }
                if (!$item && !empty($cfg['desc'])) {
                    $descKw = $cfg['desc'];
                    $item = $pr->items->first(fn($it) => stripos($it->description, $descKw) !== false);
                }
                if ($item && !empty($cfg['desc']) && stripos($item->description, $cfg['desc']) === false) {
                    $descKw = $cfg['desc'];
                    $byKw = $pr->items->first(fn($it) => stripos($it->description, $descKw) !== false);
                    if ($byKw) {
                        $item = $byKw;
                    }
                }

                if ($item) {
                    if ($cfg['action'] === 'short_close') {
                        $updateData = [
                            'remarks'          => 'Short Close',
                            'is_short_closed'  => true,
                            'short_closed_qty' => $cfg['short_qty'],
                        ];
                        if (isset($cfg['restore_qty'])) {
                            $updateData['qty'] = $cfg['restore_qty'];
                        }
                        $item->update($updateData);
                        $this->line("  ✓ Item #{$sno} ({$item->description}): Marked Short Close (Short Qty: {$cfg['short_qty']})");
                    } else {
                        $item->update([
                            'qty'              => $cfg['qty'],
                            'is_short_closed'  => false,
                            'short_closed_qty' => 0,
                        ]);
                        $this->line("  ✓ Item #{$sno} ({$item->description}): Qty updated to {$cfg['qty']}");
                    }
                    $updatedItemCount++;
                    $prModified = true;
                } else {
                    $this->warn("  ⚠️ Item #{$sno} not found in PR {$pr->pr_number}");
                }
            }

            if ($prModified) {
                // Recalculate estimated_amount for the PR
                $freshItems = $pr->items()->get();
                $newEstimated = $freshItems->sum(fn($i) => (float)$i->qty * (float)$i->estimated_price);
                $pr->update(['estimated_amount' => $newEstimated]);

                // Sync conversion status
                PurchaseRequisition::syncPrConversion($pr);
                $updatedPrCount++;
                $this->info("  -> PR {$pr->pr_number} estimated_amount: ₹{$newEstimated}, status: {$pr->fresh()->status}");
            }
        }

        // Additional PR updates for AIVN and AVT (Tailoring)
        $extraPackages = [
            [
                'name' => 'AIVN - PR 17',
                'tenant_fn' => fn() => Tenant::where('name', 'like', '%Isha%')
                    ->orWhere('name', 'like', '%Vidhya%')
                    ->orWhere('name', 'like', '%Niketan%')
                    ->orWhere('name', 'like', '%Vidhyalayam%')
                    ->first(),
                'pr_identifiers' => ['PR17', 'PR-17', 'PR 17', 'AIVN-PR17', 'AV-HIIGINBOTHAMS'],
                'item_fingerprint' => null,
                'items' => [
                    1 => ['action' => 'short_close', 'short_qty' => 4, 'desc' => 'Ultimate Guide'],
                ]
            ],
            [
                'name' => 'AVT - AVTPR2026-278 (PR 8)',
                'tenant_fn' => fn() => Tenant::where('name', 'like', '%Vidhyalayam%')
                    ->orWhere('name', 'like', '%Isha%')
                    ->orWhere('name', 'like', '%Tailoring%')
                    ->orWhere('code', 'like', '%AV%')
                    ->first(),
                'pr_identifiers' => ['AVTPR2026-278', 'AVTPR/2026-27/8', 'AVTPR2026-27/8', 'AVTPR-2026-278', 'PR8', 'PR-8'],
                'item_fingerprint' => 'Zip',
                'items' => [
                    8 => ['action' => 'update_qty', 'qty' => 5, 'desc' => 'White Zip'],
                    9 => ['action' => 'update_qty', 'qty' => 1, 'desc' => 'Black Zip'],
                    12 => ['action' => 'update_qty', 'qty' => 2, 'desc' => 'Pant Hook'],
                    13 => ['action' => 'update_qty', 'qty' => 6, 'desc' => 'Blue-Swing'],
                    14 => ['action' => 'update_qty', 'qty' => 1, 'desc' => 'White-Swing'],
                    15 => ['action' => 'update_qty', 'qty' => 1, 'desc' => 'Black-Swing'],
                    16 => ['action' => 'update_qty', 'qty' => 10, 'desc' => 'Grey-Swing'],
                    17 => ['action' => 'update_qty', 'qty' => 2, 'desc' => 'Green-Swing'],
                    18 => ['action' => 'update_qty', 'qty' => 10, 'desc' => 'Bone White-Swing'],
                    22 => ['action' => 'short_close', 'short_qty' => 1, 'desc' => 'Overlock Cone -Grey'],
                    23 => ['action' => 'short_close', 'short_qty' => 2, 'desc' => 'Overlock Cone -Green'],
                    24 => ['action' => 'short_close', 'short_qty' => 3, 'desc' => 'Overlock Cone -Bone White'],
                    31 => ['action' => 'short_close', 'short_qty' => 10, 'desc' => 'Size label-S'],
                    32 => ['action' => 'short_close', 'short_qty' => 11, 'desc' => 'Size label-M'],
                    33 => ['action' => 'short_close', 'short_qty' => 12, 'desc' => 'Size label-L'],
                    34 => ['action' => 'short_close', 'short_qty' => 13, 'desc' => 'Size label-XL'],
                    35 => ['action' => 'short_close', 'short_qty' => 16, 'desc' => 'Size label-2XL'],
                    36 => ['action' => 'short_close', 'short_qty' => 17, 'desc' => 'Size label-3XL'],
                ]
            ],
            [
                'name' => 'AVT - AVTPR2026-272 (PR 2)',
                'tenant_fn' => fn() => Tenant::where('name', 'like', '%Vidhyalayam%')
                    ->orWhere('name', 'like', '%Isha%')
                    ->orWhere('name', 'like', '%Tailoring%')
                    ->orWhere('code', 'like', '%AV%')
                    ->first(),
                'pr_identifiers' => ['AVTPR2026-272', 'AVTPR/2026-27/2', 'AVTPR2026-27/2', 'AVTPR-2026-272', 'PR2', 'PR-2'],
                'item_fingerprint' => 'Trovine',
                'items' => [
                    5 => ['action' => 'short_close', 'short_qty' => 264, 'desc' => 'Trovine'],
                ]
            ],
        ];

        foreach ($extraPackages as $pkg) {
            $t = ($pkg['tenant_fn'])();
            $tId = $t?->id;

            $prQuery = PurchaseRequisition::with('items');
            if ($tId) {
                $prQuery->where('tenant_id', $tId);
            }
            $prQuery->where(function ($q) use ($pkg) {
                foreach ($pkg['pr_identifiers'] as $idStr) {
                    $q->orWhere('pr_number', $idStr)
                      ->orWhere('pr_ref', $idStr)
                      ->orWhere('title', 'like', "%{$idStr}%");
                }
            });
            if (!empty($pkg['item_fingerprint'])) {
                $fp = $pkg['item_fingerprint'];
                $prQuery->whereExists(function ($sub) use ($fp) {
                    $sub->select(\Illuminate\Support\Facades\DB::raw(1))
                        ->from('pr_items')
                        ->whereColumn('pr_items.pr_id', 'purchase_requisitions.id')
                        ->where('description', 'like', "%{$fp}%");
                });
            }
            $pr = $prQuery->first();

            if (!$pr) {
                $fbQuery = PurchaseRequisition::with('items')->where(function ($q) use ($pkg) {
                    foreach ($pkg['pr_identifiers'] as $idStr) {
                        $q->orWhere('pr_number', $idStr)
                          ->orWhere('pr_ref', $idStr)
                          ->orWhere('title', 'like', "%{$idStr}%");
                    }
                });
                if (!empty($pkg['item_fingerprint'])) {
                    $fp = $pkg['item_fingerprint'];
                    $fbQuery->whereExists(function ($sub) use ($fp) {
                        $sub->select(\Illuminate\Support\Facades\DB::raw(1))
                            ->from('pr_items')
                            ->whereColumn('pr_items.pr_id', 'purchase_requisitions.id')
                            ->where('description', 'like', "%{$fp}%");
                    });
                }
                $pr = $fbQuery->first();
            }

            if (!$pr) {
                $this->warn("Extra PR {$pkg['name']} not found!");
                continue;
            }

            $this->info("Processing Extra PR: {$pr->pr_number} (ID: {$pr->id})");
            $prModified = false;

            foreach ($pkg['items'] as $sno => $cfg) {
                $item = $pr->items->firstWhere('sno', $sno);
                if (!$item && isset($cfg['alt_sno'])) {
                    $item = $pr->items->firstWhere('sno', $cfg['alt_sno']);
                }
                if (!$item && !empty($cfg['desc'])) {
                    $descKw = $cfg['desc'];
                    $item = $pr->items->first(fn($it) => stripos($it->description, $descKw) !== false);
                }
                if ($item && !empty($cfg['desc']) && stripos($item->description, $cfg['desc']) === false) {
                    $descKw = $cfg['desc'];
                    $byKw = $pr->items->first(fn($it) => stripos($it->description, $descKw) !== false);
                    if ($byKw) {
                        $item = $byKw;
                    }
                }

                if ($item) {
                    if ($cfg['action'] === 'short_close') {
                        $item->update([
                            'remarks'          => 'Short Close',
                            'is_short_closed'  => true,
                            'short_closed_qty' => $cfg['short_qty'],
                        ]);
                        $this->line("  ✓ Item #{$sno} ({$item->description}): Marked Short Close (Short Qty: {$cfg['short_qty']})");
                    } else {
                        $item->update([
                            'qty'              => $cfg['qty'],
                            'is_short_closed'  => false,
                            'short_closed_qty' => 0,
                        ]);
                        $this->line("  ✓ Item #{$sno} ({$item->description}): Qty updated to {$cfg['qty']}");
                    }
                    $updatedItemCount++;
                    $prModified = true;
                } else {
                    $this->warn("  ⚠️ Item #{$sno} not found in PR {$pr->pr_number}");
                }
            }

            if ($prModified) {
                $freshItems = $pr->items()->get();
                $newEstimated = $freshItems->sum(fn($i) => (float)$i->qty * (float)$i->estimated_price);
                $pr->update(['estimated_amount' => $newEstimated]);

                PurchaseRequisition::syncPrConversion($pr);
                $updatedPrCount++;
                $this->info("  -> PR {$pr->pr_number} estimated_amount: ₹{$newEstimated}, status: {$pr->fresh()->status}");
            }
        }

        // ── Ensure Apollo Vidhyalayam PO AV/2026-27/29 has exact items 1 to 4 ──
        $avTenant = Tenant::where('name', 'like', '%Apollo%Vidhyalayam%')->orWhere('code', 'like', '%APOLLO%')->first();
        $avTenantId = $avTenant?->id ?? 7;

        $avPos = \App\Models\PurchaseOrder::where(function ($q) use ($avTenantId) {
            $q->where('po_number', 'AV/2026-27/29')
              ->orWhere('po_number', 'like', '%AV%2026-27/29%')
              ->orWhere('po_number', 'like', '%2026-27/29%')
              ->orWhere(function ($sub) use ($avTenantId) {
                  $sub->where('tenant_id', $avTenantId)
                      ->where(function ($s) {
                          $s->where('po_number', 'like', '%29%')
                            ->orWhere('po_number', '29')
                            ->orWhere('id', 29);
                      });
              });
        })->get();

        $avSpecs = [
            1 => ['code' => '1222', 'name' => 'Double Side Logo & School Name Size is 12 Feet to 10 inch', 'qty' => 7.00, 'net_rate' => 2100.00, 'gst_rate' => 18.00, 'unit' => 'Nos'],
            2 => ['code' => '1223', 'name' => 'Front Glass Top Black Sticker Background Logo & School Name Size is . 7.5 Feet to 11inch', 'qty' => 7.00, 'net_rate' => 1400.00, 'gst_rate' => 18.00, 'unit' => 'Nos'],
            3 => ['code' => '1224', 'name' => 'Bus Back Side School Name & Logo Adress, Email, Ph Number QR code-Total Size is 5 Feet to 2.5 Feet', 'qty' => 7.00, 'net_rate' => 800.00, 'gst_rate' => 18.00, 'unit' => 'Nos'],
            4 => ['code' => '1225', 'name' => 'Bus Total Old Sticker Remove Labour Charges', 'qty' => 6.00, 'net_rate' => 1200.00, 'gst_rate' => 0.00, 'unit' => 'Nos'],
        ];

        foreach ($avPos as $po) {
            $existingCodes = $po->items()->pluck('product_code')->filter()->toArray();
            $needsRebuild = count($existingCodes) !== 4
                || (float) $po->grand_total !== 42918.00
                || (float) $po->freight !== 200.00
                || in_array('1226', $existingCodes)
                || in_array('1227', $existingCodes)
                || in_array('1228', $existingCodes)
                || !in_array('1222', $existingCodes);

            if ($needsRebuild) {
                $po->items()->delete();
                $itemsArray = [];

                foreach ($avSpecs as $sno => $spec) {
                    $grossRate = round($spec['net_rate'] * (1 + $spec['gst_rate'] / 100), 2);
                    $amount = round($grossRate * $spec['qty'], 2);

                    $po->items()->create([
                        'sno'             => $sno,
                        'product_code'    => $spec['code'],
                        'product_name'    => $spec['name'],
                        'description'     => $spec['name'],
                        'unit'            => $spec['unit'],
                        'qty'             => $spec['qty'],
                        'net_rate'        => $spec['net_rate'],
                        'gst_rate'        => $spec['gst_rate'],
                        'gross_rate'      => $grossRate,
                        'amount'          => $amount,
                        'required_by'     => '2026-09-21',
                        'warranty_months' => 0,
                    ]);

                    $itemsArray[] = [
                        'net_rate' => $spec['net_rate'],
                        'qty'      => $spec['qty'],
                        'gst_rate' => $spec['gst_rate'],
                    ];
                }

                $gstService = app(\App\Services\GstService::class);
                $vendorAddress   = \Illuminate\Support\Facades\DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
                $billToLocation  = \Illuminate\Support\Facades\DB::table('locations')->where('id', $po->bill_to_location_id)->first();
                $vendorStateCode = $vendorAddress?->state_code ?? '';
                $companyStateCode = $billToLocation?->state_code ?? '';

                $totals = $gstService->calculatePoTotals(
                    $itemsArray,
                    200.00,
                    $vendorStateCode,
                    $companyStateCode,
                    0.00,
                    0.00
                );

                $po->update([
                    'net_total'        => $totals['net_total'],
                    'freight'          => $totals['freight'],
                    'freight_gst_rate' => 0.00,
                    'tax_amount'       => $totals['tax_amount'],
                    'discount'         => 0.00,
                    'grand_total'      => $totals['grand_total'],
                    'round_off'        => $totals['round_off'],
                ]);

                if (\Illuminate\Support\Facades\Schema::hasTable('budget_ledger')) {
                    \Illuminate\Support\Facades\DB::table('budget_ledger')
                        ->where('reference_type', 'PO')
                        ->where('reference_id', $po->id)
                        ->where('action', 'freeze')
                        ->update(['freeze_amount' => $totals['grand_total']]);
                    \Illuminate\Support\Facades\DB::table('budget_ledger')
                        ->where('reference_type', 'PO')
                        ->where('reference_id', $po->id)
                        ->where('action', 'consume')
                        ->update(['consume_amount' => $totals['grand_total']]);
                }

                $this->info("  -> Restored PO {$po->po_number} with 4 items. Grand Total: ₹{$totals['grand_total']}");
            }
        }

        $this->info("\nCompleted! Processed {$updatedItemCount} item(s) across {$updatedPrCount} PR(s).");
        return 0;
    }
}

