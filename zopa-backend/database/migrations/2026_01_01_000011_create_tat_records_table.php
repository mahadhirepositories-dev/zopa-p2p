<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tat_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->timestamp('pr_submitted_at')->nullable();
            $table->timestamp('po_created_at')->nullable();
            $table->timestamp('po_approved_at')->nullable();
            $table->timestamp('po_released_at')->nullable();
            $table->timestamp('grn_received_at')->nullable();
            $table->timestamp('invoice_approved_at')->nullable();
            $table->timestamps();

            $table->unique('po_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tat_records');
    }
};
