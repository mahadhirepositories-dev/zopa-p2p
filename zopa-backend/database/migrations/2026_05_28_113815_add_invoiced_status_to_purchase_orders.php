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
        // Extend the ENUM to include 'invoiced' between delivered and payment_released
        DB::statement("ALTER TABLE `purchase_orders` MODIFY `status` ENUM(
            'draft','pending_l1','pending_l2','pending_l3',
            'approved','released',
            'delivered','invoiced','payment_released',
            'closed','cancelled'
        ) NOT NULL DEFAULT 'draft'");

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->timestamp('invoiced_at')->nullable()->after('delivered_at');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('invoiced_at');
        });

        DB::statement("ALTER TABLE `purchase_orders` MODIFY `status` ENUM(
            'draft','pending_l1','pending_l2','pending_l3',
            'approved','released',
            'delivered','payment_released',
            'closed','cancelled'
        ) NOT NULL DEFAULT 'draft'");
    }
};
