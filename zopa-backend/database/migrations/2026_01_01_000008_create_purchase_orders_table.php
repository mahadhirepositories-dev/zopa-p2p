<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pr_id')->nullable()->constrained('purchase_requisitions')->nullOnDelete();
            $table->string('po_number')->nullable()->unique();
            $table->date('po_date')->nullable();
            $table->foreignId('bill_to_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('ship_to_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('vendor_id')->constrained();
            $table->foreignId('vendor_address_id')->nullable()->constrained('vendor_addresses')->nullOnDelete();
            $table->foreignId('cost_center_id')->constrained();
            $table->date('po_valid_till')->nullable();
            $table->json('payment_terms_json')->nullable();
            $table->unsignedSmallInteger('warranty_months')->default(0);
            $table->longText('terms_conditions')->nullable();
            $table->decimal('freight', 15, 2)->default(0);
            $table->decimal('net_total', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('grand_total', 15, 2)->default(0);
            $table->decimal('round_off', 8, 2)->default(0);
            $table->enum('status', [
                'draft',
                'pending_l1',
                'pending_l2',
                'pending_l3',
                'approved',
                'released',
                'closed',
                'cancelled',
            ])->default('draft');
            $table->string('created_by_role', 50)->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('approved_by_role', 50)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'cost_center_id']);
        });

        Schema::create('po_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->unsignedSmallInteger('sno');
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description');
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('qty', 10, 3);
            $table->decimal('net_rate', 15, 2);
            $table->decimal('gst_rate', 5, 2)->default(18);
            $table->decimal('gross_rate', 15, 2);
            $table->decimal('amount', 15, 2);
            $table->date('required_by')->nullable();
            $table->timestamps();
        });

        Schema::create('po_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->string('name');
            $table->string('original_name');
            $table->string('file_path');
            $table->unsignedInteger('size')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('po_attachments');
        Schema::dropIfExists('po_items');
        Schema::dropIfExists('purchase_orders');
    }
};
