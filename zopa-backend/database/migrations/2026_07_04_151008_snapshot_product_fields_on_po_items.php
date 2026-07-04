<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot the product's descriptive master fields onto each po_item at creation
 * so a document never changes when the master is later edited. Financial fields
 * (net_rate, gst_rate, gross_rate, amount) were already snapshotted; these three
 * (code / name / HSN) were still being read live from the product relation on the
 * PO PDF and detail screen. Nullable — legacy rows fall back to the live product.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('po_items', function (Blueprint $table) {
            $table->string('product_code')->nullable()->after('product_id');
            $table->string('product_name')->nullable()->after('product_code');
            $table->string('hsn_code', 20)->nullable()->after('product_name');
        });
    }

    public function down(): void
    {
        Schema::table('po_items', function (Blueprint $table) {
            $table->dropColumn(['product_code', 'product_name', 'hsn_code']);
        });
    }
};
