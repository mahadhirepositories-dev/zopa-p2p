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
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_requisitions', 'short_close_reason')) {
                $table->text('short_close_reason')->nullable()->after('status');
            }
            if (!Schema::hasColumn('purchase_requisitions', 'short_closed_at')) {
                $table->timestamp('short_closed_at')->nullable()->after('short_close_reason');
            }
            if (!Schema::hasColumn('purchase_requisitions', 'short_closed_by')) {
                $table->foreignId('short_closed_by')->nullable()->after('short_closed_at')->constrained('users')->nullOnDelete();
            }
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_orders', 'delivery_status')) {
                $table->string('delivery_status', 30)->nullable()->after('status');
            }
            if (!Schema::hasColumn('purchase_orders', 'delivery_notes')) {
                $table->text('delivery_notes')->nullable()->after('delivery_status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropForeign(['short_closed_by']);
            $table->dropColumn(['short_close_reason', 'short_closed_at', 'short_closed_by']);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_status', 'delivery_notes']);
        });
    }
};
