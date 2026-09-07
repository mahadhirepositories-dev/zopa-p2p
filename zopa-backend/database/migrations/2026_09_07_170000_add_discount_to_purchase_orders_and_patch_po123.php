<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add discount column to purchase_orders if not already present
        if (Schema::hasTable('purchase_orders') && !Schema::hasColumn('purchase_orders', 'discount')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->decimal('discount', 12, 2)->default(0.00)->after('freight_gst_rate');
            });
        }

        // 2. Patch PO #123 in Apollo Isha Vidhya Niketan:
        // Current Grand Total was ₹86,944; user requested ₹5,944 discount so final amount is ₹81,000.
        $po123 = DB::table('purchase_orders')->where('id', 123)->first();
        if ($po123) {
            $discount   = 5944.00;
            $grandTotal = 81000.00;
            $rawTotal   = (float)$po123->net_total + (float)$po123->freight + (float)$po123->tax_amount - $discount;
            $roundOff   = round($grandTotal - $rawTotal, 2);

            DB::table('purchase_orders')->where('id', 123)->update([
                'discount'    => $discount,
                'grand_total' => $grandTotal,
                'round_off'   => $roundOff,
                'updated_at'  => now(),
            ]);

            // Update Budget Ledger if entry exists for PO 123
            if (Schema::hasTable('budget_ledger')) {
                DB::table('budget_ledger')
                    ->where('reference_type', 'PO')
                    ->where('reference_id', 123)
                    ->where('action', 'freeze')
                    ->update([
                        'freeze_amount' => $grandTotal,
                        'updated_at'    => now(),
                    ]);

                DB::table('budget_ledger')
                    ->where('reference_type', 'PO')
                    ->where('reference_id', 123)
                    ->where('action', 'consume')
                    ->update([
                        'consume_amount' => $grandTotal,
                        'updated_at'     => now(),
                    ]);
            }
        }

        Cache::flush();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('purchase_orders') && Schema::hasColumn('purchase_orders', 'discount')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('discount');
            });
        }
    }
};
