<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent safety migration — ensures short_close columns exist on purchase_requisitions
 * and delivery columns exist on purchase_orders regardless of migration history.
 * Safe to run multiple times.
 */
return new class extends Migration
{
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
                $table->unsignedBigInteger('short_closed_by')->nullable()->after('short_closed_at');
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

    public function down(): void
    {
        // Intentionally no-op: this is a safety migration, do not drop columns
    }
};
