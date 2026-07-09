<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('product_prefix', 10)->nullable()->after('pr_starting_series');
            $table->unsignedInteger('product_series')->default(1)->after('product_prefix');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['product_prefix', 'product_series']);
        });
    }
};
