<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;
use Illuminate\Console\Command;

class UpdatePrQuantities extends Command
{
    protected $signature = 'pr:update-quantities';
    protected $description = 'Update requested quantities for specified PR line items in Total Health organization';

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

        $updates = [
            'PR3' => [
                11 => 100,
                16 => 100,
                21 => 100,
            ],
            'PR7' => [
                18 => 600,
                30 => 300,
                66 => 30,
                68 => 100,
            ],
            'PR8' => [
                1 => 12000,
                17 => 600,
            ],
            'PR9' => [
                4 => 12,
                5 => 6,
                6 => 3,
                7 => 3,
                8 => 3,
            ],
            'PR10' => [
                1 => 18,
                3 => 4,
                4 => 9,
                6 => 9,
                8 => 18,
                9 => 36,
                10 => 4,
                11 => 27,
                13 => 4,
                14 => 4,
                15 => 9,
                16 => 9,
                17 => 9,
            ],
            'PR12' => [
                1 => 300,
            ],
            'PR18' => [
                1 => 11,
                2 => 5,
                3 => 3,
                4 => 20,
                5 => 6,
                6 => 6,
                7 => 5,
                14 => 8,
                15 => 12,
            ],
            'PR19' => [
                1 => 5,
                2 => 24,
                3 => 45,
                4 => 25,
                5 => 27,
                6 => 21,
                7 => 8,
                8 => 16,
                9 => 45,
                10 => 55,
                11 => 2,
                12 => 10,
            ],
            'PR20' => [
                19 => 200,
            ],
            'PR22' => [
                3 => 3,
                7 => 1,
                8 => 1,
            ],
            'PR32' => [
                1 => 1,
                2 => 1,
                3 => 4,
                4 => 1,
                5 => 1,
                6 => 1,
                7 => 2,
                8 => 3,
                10 => 1,
                12 => 1,
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
                // Search across all tenants if tenant_id didn't match
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

            foreach ($itemsToUpdate as $sno => $newQty) {
                $item = $pr->items->firstWhere('sno', $sno);
                if ($item) {
                    $oldQty = $item->qty;
                    $item->update(['qty' => $newQty]);
                    $this->line("  ✓ Item #{$sno} ({$item->description}): Qty updated from {$oldQty} to {$newQty}");
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
                $this->info("  -> PR {$pr->pr_number} estimated_amount updated to ₹{$newEstimated}, status synced: {$pr->fresh()->status}");
            }
        }

        $this->info("\nCompleted! Updated {$updatedItemCount} item(s) across {$updatedPrCount} PR(s).");
        return 0;
    }
}
