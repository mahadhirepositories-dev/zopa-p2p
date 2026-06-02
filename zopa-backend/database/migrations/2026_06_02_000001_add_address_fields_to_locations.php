<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Split a location's address into structured fields. `address` and `state`
 * already exist; add city, pincode and country.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'city')) {
                $table->string('city', 100)->nullable()->after('address');
            }
            if (!Schema::hasColumn('locations', 'pincode')) {
                $table->string('pincode', 12)->nullable()->after('state_code');
            }
            if (!Schema::hasColumn('locations', 'country')) {
                $table->string('country', 100)->nullable()->default('India')->after('pincode');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn(['city', 'pincode', 'country']);
        });
    }
};
