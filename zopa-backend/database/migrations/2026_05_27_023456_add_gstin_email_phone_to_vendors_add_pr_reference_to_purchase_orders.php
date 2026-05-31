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
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('gstin', 20)->nullable()->after('pan');
            $table->string('email', 100)->nullable()->after('gstin');
            $table->string('phone', 20)->nullable()->after('email');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('pr_reference', 100)->nullable()->after('pr_id');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn(['gstin', 'email', 'phone']);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('pr_reference');
        });
    }
};
