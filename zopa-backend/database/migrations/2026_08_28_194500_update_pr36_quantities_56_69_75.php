<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\PurchaseRequisition;

return new class extends Migration
{
    /**
     * Update PR36 line item quantities:
     * - Line 56: qty -> 1
     * - Line 69: qty -> 50
     * - Line 75: qty -> 10
     * Recalculate estimated_amount and sync PR conversion.
     */
    public function up(): void
    {
        $prs = DB::table('purchase_requisitions')
            ->where(function ($q) {
                $q->where('pr_number', 'PR36')
                  ->orWhere('pr_number', 'PR-36')
                  ->orWhere('pr_number', 'LIKE', '%PR%36%')
                  ->orWhere('pr_ref', 'PR36')
                  ->orWhere('pr_ref', 'PR-36')
                  ->orWhere('id', 36);
            })
            ->get();

        foreach ($prs as $pr) {
            $prId = $pr->id;

            // Line 56 -> Qty 1
            DB::table('pr_items')
                ->where('pr_id', $prId)
                ->where('sno', 56)
                ->update([
                    'qty'        => 1,
                    'updated_at' => now(),
                ]);

            // Line 69 -> Qty 50
            DB::table('pr_items')
                ->where('pr_id', $prId)
                ->where('sno', 69)
                ->update([
                    'qty'        => 50,
                    'updated_at' => now(),
                ]);

            // Line 75 -> Qty 10
            DB::table('pr_items')
                ->where('pr_id', $prId)
                ->where('sno', 75)
                ->update([
                    'qty'        => 10,
                    'updated_at' => now(),
                ]);

            // Recalculate PR estimated_amount
            $items = DB::table('pr_items')->where('pr_id', $prId)->get();
            $estimatedAmount = $items->sum(function ($item) {
                return (float)$item->qty * (float)$item->estimated_price;
            });

            DB::table('purchase_requisitions')->where('id', $prId)->update([
                'estimated_amount' => $estimatedAmount,
                'updated_at'       => now(),
            ]);

            // Sync PR conversion if model exists
            $prModel = PurchaseRequisition::find($prId);
            if ($prModel) {
                PurchaseRequisition::syncPrConversion($prModel);
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
