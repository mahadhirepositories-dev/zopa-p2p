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
        // Extend the ENUM to include the two new post-release statuses
        DB::statement("ALTER TABLE `purchase_orders` MODIFY `status` ENUM(
            'draft','pending_l1','pending_l2','pending_l3',
            'approved','released',
            'delivered','payment_released',
            'closed','cancelled'
        ) NOT NULL DEFAULT 'draft'");
    }

    public function down(): void
    {
        // Roll back to original ENUM (removes delivered/payment_released values)
        DB::statement("ALTER TABLE `purchase_orders` MODIFY `status` ENUM(
            'draft','pending_l1','pending_l2','pending_l3',
            'approved','released',
            'closed','cancelled'
        ) NOT NULL DEFAULT 'draft'");
    }
};
