<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cost_centers', function (Blueprint $table) {
            $table->date('budget_from')->nullable()->after('annual_budget');
            $table->date('budget_to')->nullable()->after('budget_from');
        });

        // Add 'adjust' action and adjust_amount column to budget_ledger
        Schema::table('budget_ledger', function (Blueprint $table) {
            $table->decimal('adjust_amount', 15, 2)->default(0)->after('consume_amount');
        });

        // For MySQL we need to modify the ENUM to add 'adjust'
        DB::statement("ALTER TABLE budget_ledger MODIFY COLUMN action ENUM('freeze','release','consume','adjust') NOT NULL");
    }

    public function down(): void
    {
        Schema::table('cost_centers', function (Blueprint $table) {
            $table->dropColumn(['budget_from', 'budget_to']);
        });
        Schema::table('budget_ledger', function (Blueprint $table) {
            $table->dropColumn('adjust_amount');
        });
        DB::statement("ALTER TABLE budget_ledger MODIFY COLUMN action ENUM('freeze','release','consume') NOT NULL");
    }
};
