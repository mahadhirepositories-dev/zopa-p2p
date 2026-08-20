<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseOrder;
use App\Models\PoItem;
use App\Models\PrItem;

return new class extends Migration
{
    /**
     * Run the enhanced syncPrConversion algorithm on all PRs to ensure
     * master product matching, quantity matching, and SNO matching properly resolve.
     */
    public function up(): void
    {
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $pr) {
            PurchaseRequisition::syncPrConversion($pr);
        }
    }

    public function down(): void {}
};
