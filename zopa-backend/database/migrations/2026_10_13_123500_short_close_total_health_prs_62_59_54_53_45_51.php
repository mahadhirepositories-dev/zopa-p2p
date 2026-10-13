<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;
use App\Models\Tenant;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Short-closes the specified line items on Total Health PRs:
     * - PR62: Line Item 10 (Qty 11) -> Short Close
     * - PR59: Line Item 1  (Qty 6000) -> Short Close
     * - PR54: Line Item 2  (Qty 39670) -> Short Close
     * - PR53: Line Item 14 (Qty 4), Line Item 15 (Qty 16), Line Item 17 (Qty 30), Line Item 30 (Qty 5) -> Short Close
     * - PR45: Line Item 3  (Qty 11), Line Item 6 (Qty 11) -> Short Close
     * - PR51: Line Item 5  (Qty 11) -> Short Close
     */
    public function up(): void
    {
        $tenant = Tenant::where('name', 'like', '%Total Health%')
            ->orWhere('code', 'TH')
            ->orWhere('code', 'like', '%TOTAL%')
            ->first();

        $tenantId = $tenant?->id;
        echo "Resolved Total Health Tenant ID: " . ($tenantId ?? 'NULL') . "\n";

        $prShortCloseMap = [
            62 => [
                ['sno' => 10, 'qty' => 11],
            ],
            59 => [
                ['sno' => 1, 'qty' => 6000],
            ],
            54 => [
                ['sno' => 2, 'qty' => 39670],
            ],
            53 => [
                ['sno' => 14, 'qty' => 4],
                ['sno' => 15, 'qty' => 16],
                ['sno' => 17, 'qty' => 30],
                ['sno' => 30, 'qty' => 5],
            ],
            45 => [
                ['sno' => 3, 'qty' => 11],
                ['sno' => 6, 'qty' => 11],
            ],
            51 => [
                ['sno' => 5, 'qty' => 11],
            ],
        ];

        foreach ($prShortCloseMap as $num => $lineItems) {
            $candidates = [
                "PR{$num}",
                "PR-{$num}",
                "PR {$num}",
                "PR0{$num}",
                "PR-0{$num}",
                "TH/2026-27/{$num}",
                "TH-PR-{$num}",
                "TOTAL HEALTH-PR {$num}",
                (string) $num,
            ];

            $query = PurchaseRequisition::with('items');
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            $pr = (clone $query)->where(function ($q) use ($candidates, $num) {
                foreach ($candidates as $c) {
                    $q->orWhere('pr_number', $c)
                      ->orWhere('pr_ref', $c);
                }
                $q->orWhere('pr_number', 'like', "%PR{$num}")
                  ->orWhere('pr_number', 'like', "%PR-{$num}")
                  ->orWhere('pr_number', 'like', "%/{$num}");
            })->first();

            // Fallback across all tenants if not found under primary tenantId
            if (!$pr) {
                $pr = PurchaseRequisition::with('items')
                    ->where(function ($q) use ($candidates) {
                        foreach ($candidates as $c) {
                            $q->orWhere('pr_number', $c)
                              ->orWhere('pr_ref', $c);
                        }
                    })
                    ->first();
            }

            if (!$pr) {
                echo "WARNING: PR{$num} not found!\n";
                continue;
            }

            echo "Found PR{$num} -> ID: {$pr->id}, PR Number: '{$pr->pr_number}', Status: '{$pr->status}', Items count: " . $pr->items->count() . "\n";

            $prModified = false;
            $orderedItems = $pr->items->sortBy('sno')->values();

            foreach ($lineItems as $cfg) {
                $targetSno = (int) $cfg['sno'];
                $targetQty = (float) $cfg['qty'];

                // 1. Match by explicit sno column
                $prItem = $pr->items->firstWhere('sno', $targetSno);

                // 2. Fallback to 1-based positional index if sno didn't match
                if (!$prItem && isset($orderedItems[$targetSno - 1])) {
                    $prItem = $orderedItems[$targetSno - 1];
                }

                if (!$prItem) {
                    echo "  WARNING: Line Item {$targetSno} not found on PR '{$pr->pr_number}' (ID {$pr->id})\n";
                    continue;
                }

                $prItem->update([
                    'is_short_closed'  => true,
                    'remarks'          => 'Short Close',
                    'short_closed_qty' => $targetQty > 0 ? $targetQty : (float) $prItem->qty,
                    'updated_at'       => now(),
                ]);

                echo "  Short-closed Line Item {$targetSno} (Item ID {$prItem->id}, Desc: '{$prItem->description}', Short Close Qty: {$targetQty})\n";
                $prModified = true;
            }

            if ($prModified) {
                $freshItems = $pr->items()->get();
                $newEstimated = $freshItems->sum(function ($i) {
                    return (float) $i->qty * (float) $i->estimated_price;
                });

                $pr->update([
                    'estimated_amount' => $newEstimated,
                    'updated_at'       => now(),
                ]);

                // Sync PR conversion & short_closed / partially_converted status
                PurchaseRequisition::syncPrConversion($pr);

                $pr->refresh();
                echo "  Updated PR '{$pr->pr_number}' status -> '{$pr->status}'\n";
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
