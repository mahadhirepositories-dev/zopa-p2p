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
        Schema::table('pr_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pr_items', 'is_short_closed')) {
                $table->boolean('is_short_closed')->default(false)->after('converted_qty');
            }
            if (!Schema::hasColumn('pr_items', 'short_closed_qty')) {
                $table->decimal('short_closed_qty', 10, 3)->default(0)->after('is_short_closed');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pr_items', function (Blueprint $table) {
            if (Schema::hasColumn('pr_items', 'is_short_closed')) {
                $table->dropColumn('is_short_closed');
            }
            if (Schema::hasColumn('pr_items', 'short_closed_qty')) {
                $table->dropColumn('short_closed_qty');
            }
        });
    }
};
