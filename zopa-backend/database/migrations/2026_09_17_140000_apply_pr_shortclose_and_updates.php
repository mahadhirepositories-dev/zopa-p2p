<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;
use App\Models\Tenant;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Applies short-close and quantity updates from pr-shortclose.xlsx:
     * 1. TOTAL HEALTH - PR 40: Short close lines 6, 8, 42, 50, 59
     * 2. AIVN - PR 17: Short close line 1
     * 3. AVT - AVTPR2026-278 (PR8): Update quantities for lines 8, 9, 12, 13, 14, 15, 16, 17, 18; Short close lines 22, 23, 24, 31, 32, 33, 34, 35, 36
     * 4. AVT - AVTPR2026-272 (PR2): Short close line 5
     */
    public function up(): void
    {
        $prPackages = [
            // 1. TOTAL HEALTH - PR 40
            [
                'name' => 'TOTAL HEALTH - PR 40',
                'tenant_fn' => function() {
                    return Tenant::where('name', 'like', '%Total Health%')->orWhere('code', 'TH')->first();
                },
                'pr_identifiers' => ['PR40', 'PR-40', 'PR 40', 'TOTAL HEALTH-PR 40'],
                'item_fingerprint' => null,
                'items' => [
                    ['sno' => 6, 'action' => 'short_close', 'qty' => 1800, 'desc' => 'PAIN RELIFE'],
                    ['sno' => 8, 'action' => 'short_close', 'qty' => 2000, 'desc' => 'CETRIZINE'],
                    ['sno' => 42, 'action' => 'short_close', 'qty' => 5, 'desc' => 'AVIL'],
                    ['sno' => 50, 'action' => 'short_close', 'qty' => 1000, 'desc' => 'OKASET', 'alt_sno' => 1000],
                    ['sno' => 59, 'action' => 'short_close', 'qty' => 600, 'desc' => 'OKASET', 'alt_sno' => 600],
                ]
            ],

            // 2. AIVN - PR 17
            [
                'name' => 'AIVN - PR 17',
                'tenant_fn' => function() {
                    return Tenant::where('name', 'like', '%Isha%')
                        ->orWhere('name', 'like', '%Vidhya%')
                        ->orWhere('name', 'like', '%Niketan%')
                        ->orWhere('name', 'like', '%Vidhyalayam%')
                        ->first();
                },
                'pr_identifiers' => ['PR17', 'PR-17', 'PR 17', 'AIVN-PR17', 'AV-HIIGINBOTHAMS'],
                'item_fingerprint' => null,
                'items' => [
                    ['sno' => 1, 'action' => 'short_close', 'qty' => 4, 'desc' => 'Ultimate Guide'],
                ]
            ],

            // 3. AVT - AVTPR2026-278 (PR8 Tailoring accessories)
            [
                'name' => 'AVT - AVTPR2026-278 (PR 8)',
                'tenant_fn' => function() {
                    return Tenant::where('name', 'like', '%Vidhyalayam%')
                        ->orWhere('name', 'like', '%Isha%')
                        ->orWhere('name', 'like', '%Tailoring%')
                        ->orWhere('code', 'like', '%AV%')
                        ->first();
                },
                'pr_identifiers' => ['AVTPR2026-278', 'AVTPR/2026-27/8', 'AVTPR2026-27/8', 'AVTPR-2026-278', 'PR8', 'PR-8'],
                'item_fingerprint' => 'Zip',
                'items' => [
                    ['sno' => 8, 'action' => 'update_qty', 'qty' => 5, 'desc' => 'White Zip'],
                    ['sno' => 9, 'action' => 'update_qty', 'qty' => 1, 'desc' => 'Black Zip'],
                    ['sno' => 12, 'action' => 'update_qty', 'qty' => 2, 'desc' => 'Pant Hook'],
                    ['sno' => 13, 'action' => 'update_qty', 'qty' => 6, 'desc' => 'Blue-Swing'],
                    ['sno' => 14, 'action' => 'update_qty', 'qty' => 1, 'desc' => 'White-Swing'],
                    ['sno' => 15, 'action' => 'update_qty', 'qty' => 1, 'desc' => 'Black-Swing'],
                    ['sno' => 16, 'action' => 'update_qty', 'qty' => 10, 'desc' => 'Grey-Swing'],
                    ['sno' => 17, 'action' => 'update_qty', 'qty' => 2, 'desc' => 'Green-Swing'],
                    ['sno' => 18, 'action' => 'update_qty', 'qty' => 10, 'desc' => 'Bone White-Swing'],
                    ['sno' => 22, 'action' => 'short_close', 'qty' => 1, 'desc' => 'Overlock Cone -Grey'],
                    ['sno' => 23, 'action' => 'short_close', 'qty' => 2, 'desc' => 'Overlock Cone -Green'],
                    ['sno' => 24, 'action' => 'short_close', 'qty' => 3, 'desc' => 'Overlock Cone -Bone White'],
                    ['sno' => 31, 'action' => 'short_close', 'qty' => 10, 'desc' => 'Size label-S'],
                    ['sno' => 32, 'action' => 'short_close', 'qty' => 11, 'desc' => 'Size label-M'],
                    ['sno' => 33, 'action' => 'short_close', 'qty' => 12, 'desc' => 'Size label-L'],
                    ['sno' => 34, 'action' => 'short_close', 'qty' => 13, 'desc' => 'Size label-XL'],
                    ['sno' => 35, 'action' => 'short_close', 'qty' => 16, 'desc' => 'Size label-2XL'],
                    ['sno' => 36, 'action' => 'short_close', 'qty' => 17, 'desc' => 'Size label-3XL'],
                ]
            ],

            // 4. AVT - AVTPR2026-272 (PR2 Tailoring fabric)
            [
                'name' => 'AVT - AVTPR2026-272 (PR 2)',
                'tenant_fn' => function() {
                    return Tenant::where('name', 'like', '%Vidhyalayam%')
                        ->orWhere('name', 'like', '%Isha%')
                        ->orWhere('name', 'like', '%Tailoring%')
                        ->orWhere('code', 'like', '%AV%')
                        ->first();
                },
                'pr_identifiers' => ['AVTPR2026-272', 'AVTPR/2026-27/2', 'AVTPR2026-27/2', 'AVTPR-2026-272', 'PR2', 'PR-2'],
                'item_fingerprint' => 'Trovine',
                'items' => [
                    ['sno' => 5, 'action' => 'short_close', 'qty' => 264, 'desc' => 'Trovine'],
                ]
            ],
        ];

        foreach ($prPackages as $pkg) {
            $tenant = ($pkg['tenant_fn'])();
            $tenantId = $tenant?->id;

            // Search for PR
            $prQuery = PurchaseRequisition::with('items');

            if ($tenantId) {
                $prQuery->where('tenant_id', $tenantId);
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
                    $sub->select(DB::raw(1))
                        ->from('pr_items')
                        ->whereColumn('pr_items.pr_id', 'purchase_requisitions.id')
                        ->where('description', 'like', "%{$fp}%");
                });
            }

            $pr = $prQuery->first();

            // Fallback search without tenant filter if not found
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
                        $sub->select(DB::raw(1))
                            ->from('pr_items')
                            ->whereColumn('pr_items.pr_id', 'purchase_requisitions.id')
                            ->where('description', 'like', "%{$fp}%");
                    });
                }
                $pr = $fbQuery->first();
            }

            if (!$pr) {
                continue;
            }

            $prModified = false;

            foreach ($pkg['items'] as $itemCfg) {
                $sno = $itemCfg['sno'];
                $altSno = $itemCfg['alt_sno'] ?? null;
                $descKw = $itemCfg['desc'] ?? '';
                $action = $itemCfg['action'];
                $targetQty = (float) $itemCfg['qty'];

                // Match PR item by sno, alt_sno, or description keyword
                $prItem = $pr->items->firstWhere('sno', $sno);
                if (!$prItem && $altSno) {
                    $prItem = $pr->items->firstWhere('sno', $altSno);
                }
                if (!$prItem && !empty($descKw)) {
                    $prItem = $pr->items->first(function ($it) use ($descKw) {
                        return stripos($it->description, $descKw) !== false;
                    });
                }

                // If sno matched but description is totally different, verify keyword match
                if ($prItem && !empty($descKw)) {
                    if (stripos($prItem->description, $descKw) === false) {
                        // Look for another item that has this keyword
                        $byKw = $pr->items->first(function ($it) use ($descKw) {
                            return stripos($it->description, $descKw) !== false;
                        });
                        if ($byKw) {
                            $prItem = $byKw;
                        }
                    }
                }

                if (!$prItem) {
                    continue;
                }

                if ($action === 'short_close') {
                    $prItem->update([
                        'is_short_closed'  => true,
                        'remarks'          => 'Short Close',
                        'short_closed_qty' => $targetQty > 0 ? $targetQty : (float)$prItem->qty,
                        'updated_at'       => now(),
                    ]);
                    $prModified = true;
                } elseif ($action === 'update_qty') {
                    $prItem->update([
                        'qty'              => $targetQty,
                        'is_short_closed'  => false,
                        'short_closed_qty' => 0,
                        'updated_at'       => now(),
                    ]);
                    $prModified = true;
                }
            }

            if ($prModified) {
                // Recalculate estimated amount
                $freshItems = $pr->items()->get();
                $newEstimated = $freshItems->sum(function ($i) {
                    return (float)$i->qty * (float)$i->estimated_price;
                });

                $pr->update([
                    'estimated_amount' => $newEstimated,
                    'updated_at'       => now(),
                ]);

                // Sync conversion status
                PurchaseRequisition::syncPrConversion($pr);
            }
        }
    }

    public function down(): void
    {
    }
};
