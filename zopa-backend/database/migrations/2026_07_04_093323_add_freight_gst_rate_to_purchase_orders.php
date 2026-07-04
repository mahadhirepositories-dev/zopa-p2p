<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-PO freight GST rate. Freight is now taxed at an explicit rate the buyer
 * selects (0/5/12/18/28), applied on top of the freight amount — consistent with
 * how line-item net_rate + gst_rate work. Default 0 so existing rows (whose stored
 * totals are not recomputed) are unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->decimal('freight_gst_rate', 5, 2)->default(0)->after('freight');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('freight_gst_rate');
        });
    }
};
