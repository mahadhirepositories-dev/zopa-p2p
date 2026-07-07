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
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('po_prefix', 50)->default('PO')->change();
            $table->integer('po_starting_series')->default(1)->after('po_prefix');
            $table->string('pr_prefix', 50)->default('PR')->after('po_starting_series');
            $table->integer('pr_starting_series')->default(1)->after('pr_prefix');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('po_prefix', 20)->default('PO')->change();
            $table->dropColumn('po_starting_series');
            $table->dropColumn('pr_prefix');
            $table->dropColumn('pr_starting_series');
        });
    }
};
