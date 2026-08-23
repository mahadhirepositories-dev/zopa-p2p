<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Sourcing Requests Table
        if (!Schema::hasTable('sourcing_requests')) {
            Schema::create('sourcing_requests', function (Blueprint $table) {
                $table->id();
                $table->string('sourcing_number', 50)->unique();
                $table->enum('source_type', ['pr', 'direct'])->default('direct');
                
                // PR linkage (if created from PR)
                $table->unsignedBigInteger('pr_id')->nullable();
                $table->unsignedBigInteger('pr_item_id')->nullable();
                $table->string('pr_ref', 100)->nullable();
                $table->string('rfq_ref', 100)->nullable();

                // Item Details
                $table->string('item_name');
                $table->unsignedBigInteger('product_id')->nullable();
                $table->text('specification')->nullable();
                $table->unsignedBigInteger('category_id')->nullable();
                $table->string('category_name', 150)->nullable();
                $table->decimal('qty', 12, 3)->default(1);
                $table->string('unit', 50)->default('Nos');
                $table->decimal('target_price', 12, 2)->nullable();

                // Organization & Delivery Location
                $table->unsignedBigInteger('tenant_id')->nullable();
                $table->string('client_name', 150)->nullable();
                $table->unsignedBigInteger('location_id')->nullable();
                $table->string('delivery_location', 255)->nullable();

                // Status & Creator
                $table->enum('status', ['open', 'closed'])->default('open');
                $table->unsignedBigInteger('created_by');
                $table->timestamp('closed_at')->nullable();
                $table->unsignedBigInteger('closed_by')->nullable();
                $table->text('closure_notes')->nullable();

                $table->timestamps();

                $table->foreign('pr_id')->references('id')->on('purchase_requisitions')->onDelete('set null');
                $table->foreign('pr_item_id')->references('id')->on('pr_items')->onDelete('set null');
                $table->foreign('product_id')->references('id')->on('products')->onDelete('set null');
                $table->foreign('category_id')->references('id')->on('categories')->onDelete('set null');
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('set null');
                $table->foreign('location_id')->references('id')->on('locations')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('closed_by')->references('id')->on('users')->onDelete('set null');

                $table->index(['status', 'source_type']);
                $table->index(['tenant_id']);
                $table->index(['created_by']);
            });
        }

        // 2. Sourcing Vendor Contacts Table (Multiple entries per item)
        if (!Schema::hasTable('sourcing_vendor_contacts')) {
            Schema::create('sourcing_vendor_contacts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('sourcing_request_id');
                $table->unsignedBigInteger('vendor_id')->nullable();
                $table->string('vendor_name');
                $table->string('contact_person', 150)->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('email', 150)->nullable();
                $table->decimal('quoted_price', 12, 2)->nullable();
                $table->decimal('gst_rate', 5, 2)->nullable();
                $table->integer('lead_time_days')->nullable();
                $table->string('payment_terms', 255)->nullable();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by');
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->foreign('sourcing_request_id')->references('id')->on('sourcing_requests')->onDelete('cascade');
                $table->foreign('vendor_id')->references('id')->on('vendors')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');

                $table->index(['sourcing_request_id']);
            });
        }

        // 3. Sourcing Remarks Table (Call logs / buyer working notes)
        if (!Schema::hasTable('sourcing_remarks')) {
            Schema::create('sourcing_remarks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('sourcing_request_id');
                $table->unsignedBigInteger('user_id');
                $table->text('remark');
                $table->timestamps();

                $table->foreign('sourcing_request_id')->references('id')->on('sourcing_requests')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

                $table->index(['sourcing_request_id']);
            });
        }

        // 4. Seed 'sourcing' permissions for ZOPA roles
        $zopaRoles = [
            'zopa_super_admin' => ['can_view' => 1, 'can_create' => 1, 'can_edit' => 1, 'can_delete' => 1],
            'zopa_buyer'       => ['can_view' => 1, 'can_create' => 1, 'can_edit' => 1, 'can_delete' => 0],
            'zopa_approver_l1' => ['can_view' => 1, 'can_create' => 1, 'can_edit' => 1, 'can_delete' => 0],
            'zopa_approver_l2' => ['can_view' => 1, 'can_create' => 1, 'can_edit' => 1, 'can_delete' => 0],
            'zopa_approver_l3' => ['can_view' => 1, 'can_create' => 1, 'can_edit' => 1, 'can_delete' => 0],
        ];

        $now = now()->toDateTimeString();
        foreach ($zopaRoles as $role => $perms) {
            DB::table('role_permissions')->updateOrInsert(
                ['role' => $role, 'module' => 'sourcing'],
                array_merge($perms, ['created_at' => $now, 'updated_at' => $now])
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sourcing_remarks');
        Schema::dropIfExists('sourcing_vendor_contacts');
        Schema::dropIfExists('sourcing_requests');
        DB::table('role_permissions')->where('module', 'sourcing')->delete();
    }
};
