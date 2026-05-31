<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('po_items', function (Blueprint $table) {
            $table->unsignedSmallInteger('warranty_months')->default(0)->after('required_by');
        });
    }

    public function down(): void
    {
        Schema::table('po_items', function (Blueprint $table) {
            $table->dropColumn('warranty_months');
        });
    }
};
