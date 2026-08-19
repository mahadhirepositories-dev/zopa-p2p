<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Tenant;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tenant = Tenant::where('name', 'like', '%Total Health%')
            ->orWhere('code', 'like', '%TH%')
            ->orWhere('code', 'like', '%TOTAL%')
            ->first();

        if (!$tenant) {
            $tenant = Tenant::first();
        }

        if (!$tenant) {
            return;
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
                3 => 6,
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
                continue;
            }

            $prModified = false;
            foreach ($itemsToUpdate as $sno => $newQty) {
                $item = $pr->items->firstWhere('sno', $sno);
                if ($item) {
                    $item->update(['qty' => $newQty]);
                    $prModified = true;
                }
            }

            if ($prModified) {
                $freshItems = $pr->items()->get();
                $newEstimated = $freshItems->sum(fn($i) => (float)$i->qty * (float)$i->estimated_price);
                $pr->update(['estimated_amount' => $newEstimated]);
                PurchaseRequisition::syncPrConversion($pr);
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
