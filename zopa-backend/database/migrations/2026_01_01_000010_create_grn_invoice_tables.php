<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->string('grn_number')->unique();
            $table->date('received_date');
            $table->foreignId('received_by')->constrained('users');
            $table->enum('status', ['draft', 'confirmed', 'rejected'])->default('draft');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('grn_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grn_id')->constrained()->cascadeOnDelete();
            $table->foreignId('po_item_id')->constrained()->cascadeOnDelete();
            $table->decimal('received_qty', 10, 3)->default(0);
            $table->decimal('accepted_qty', 10, 3)->default(0);
            $table->decimal('rejected_qty', 10, 3)->default(0);
            $table->text('remarks')->nullable();
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('grn_id')->nullable()->constrained('grns')->nullOnDelete();
            $table->string('invoice_number');
            $table->date('invoice_date');
            $table->string('vendor_invoice_ref')->nullable();
            $table->decimal('amount', 15, 2);
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('grn_items');
        Schema::dropIfExists('grns');
    }
};
