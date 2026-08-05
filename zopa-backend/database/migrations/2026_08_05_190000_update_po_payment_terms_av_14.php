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
        DB::table('purchase_orders')
            ->where('po_number', 'AV/2026-27/14')
            ->update([
                'payment_terms_json' => json_encode([
                    [
                        'stage' => 'Advance',
                        'percentage' => 100,
                        'credit_days' => 0
                    ]
                ])
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('purchase_orders')
            ->where('po_number', 'AV/2026-27/14')
            ->update([
                'payment_terms_json' => json_encode([
                    [
                        'stage' => 'On Delivery',
                        'percentage' => 100,
                        'credit_days' => 30
                    ]
                ])
            ]);
    }
};
