<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $allPrs = PurchaseRequisition::with(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items'])->get();
        foreach ($allPrs as $pr) {
            PurchaseRequisition::syncPrConversion($pr);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
