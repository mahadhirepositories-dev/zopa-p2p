<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Drop the global unique index — collides across tenants sharing the same po_prefix
            $table->dropUnique('purchase_orders_po_number_unique');

            // Replace with a per-tenant composite unique constraint
            $table->unique(['tenant_id', 'po_number'], 'purchase_orders_tenant_po_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropUnique('purchase_orders_tenant_po_number_unique');
            $table->unique('po_number', 'purchase_orders_po_number_unique');
        });
    }
};
