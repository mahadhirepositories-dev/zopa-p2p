<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Track how much of each PR item has been converted to PO items
        Schema::table('pr_items', function (Blueprint $table) {
            $table->decimal('converted_qty', 10, 3)->default(0)->after('qty');
        });

        // Each PO item can trace back to the PR item it was created from
        Schema::table('po_items', function (Blueprint $table) {
            $table->foreignId('pr_item_id')->nullable()->after('product_id')
                ->constrained('pr_items')->nullOnDelete();
        });

        // PO can be linked to multiple PRs
        Schema::create('po_prs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('pr_id')->constrained('purchase_requisitions')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['po_id', 'pr_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('po_prs');
        Schema::table('po_items', function (Blueprint $table) {
            $table->dropForeign(['pr_item_id']);
            $table->dropColumn('pr_item_id');
        });
        Schema::table('pr_items', function (Blueprint $table) {
            $table->dropColumn('converted_qty');
        });
    }
};
