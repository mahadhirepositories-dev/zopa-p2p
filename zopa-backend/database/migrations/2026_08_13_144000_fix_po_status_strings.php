<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Map any 'sent_to_vendor' status strings to standard 'released'
        DB::table('purchase_orders')
            ->where('status', 'sent_to_vendor')
            ->update(['status' => 'released']);

        // Map any 'fully_delivered' status strings to standard 'delivered'
        DB::table('purchase_orders')
            ->where('status', 'fully_delivered')
            ->update(['status' => 'delivered']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op for status normalization
    }
};
