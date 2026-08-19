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
            foreach ($itemsToUpdate as $sno => $cfg) {
                $item = $pr->items->firstWhere('sno', $sno);
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
                    } else {
                        $item->update(['qty' => $cfg['qty']]);
                    }
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
