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
        Schema::table('grns', function (Blueprint $table) {
            // Drop the global unique index on grn_number alone
            $table->dropUnique('grns_grn_number_unique');

            // Replace with a per-tenant composite unique constraint
            $table->unique(['tenant_id', 'grn_number'], 'grns_tenant_grn_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('grns', function (Blueprint $table) {
            $table->dropUnique('grns_tenant_grn_number_unique');
            $table->unique('grn_number', 'grns_grn_number_unique');
        });
    }
};
