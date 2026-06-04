<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('po_items', function (Blueprint $table) {
            // Per-line Unit of Measure (UOM). Nullable so existing rows and
            // product-derived units keep working unchanged.
            $table->string('unit', 20)->nullable()->after('qty');
        });
    }

    public function down(): void
    {
        Schema::table('po_items', function (Blueprint $table) {
            $table->dropColumn('unit');
        });
    }
};
