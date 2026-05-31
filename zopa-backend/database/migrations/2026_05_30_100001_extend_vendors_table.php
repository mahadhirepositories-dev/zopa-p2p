<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('global_vendor_code', 100)->nullable()->after('name');
            $table->string('entity_code', 100)->nullable()->after('global_vendor_code');
            $table->enum('vendor_type', ['manufacturer','distributor','service_provider','consultant'])->nullable()->after('entity_code');
            $table->enum('entity_type', ['public','pvt_ltd','llp','partnership','individual','overseas_company','others'])->nullable()->after('vendor_type');
            $table->boolean('pan_not_available')->default(false)->after('pan');
            $table->enum('gst_status', ['registered','unregistered','overseas'])->nullable()->after('gstin');
            $table->string('currency', 10)->default('INR')->after('phone');
            // Bank details
            $table->string('account_no', 50)->nullable();
            $table->string('ifsc', 20)->nullable();
            $table->string('micr', 20)->nullable();
            $table->string('bank_name', 100)->nullable();
            $table->string('branch_name', 100)->nullable();
            // Special status
            $table->enum('special_status', ['msme','non_msme','sez','others'])->nullable();
            $table->string('special_status_reg_no', 100)->nullable();
            $table->date('special_status_start_date')->nullable();
            $table->date('special_status_end_date')->nullable();
        });

        // Multiple categories per vendor
        Schema::create('vendor_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->foreignId('subcategory_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->timestamps();
            $table->index('vendor_id');
        });

        // Vendor documents
        Schema::create('vendor_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->enum('document_type', ['pan','gst','cancelled_cheque','additional'])->default('additional');
            $table->string('file_name');
            $table->string('original_name');
            $table->string('file_path');
            $table->unsignedInteger('size')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamps();
            $table->index(['vendor_id', 'document_type']);
        });

        // Enhanced address fields
        Schema::table('vendor_addresses', function (Blueprint $table) {
            $table->string('pincode', 20)->nullable()->after('address');
            $table->string('city', 100)->nullable()->after('pincode');
            $table->string('country', 100)->default('India')->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('vendor_addresses', function (Blueprint $table) {
            $table->dropColumn(['pincode', 'city', 'country']);
        });
        Schema::dropIfExists('vendor_documents');
        Schema::dropIfExists('vendor_categories');
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn([
                'global_vendor_code','entity_code','vendor_type','entity_type',
                'pan_not_available','gst_status','currency',
                'account_no','ifsc','micr','bank_name','branch_name',
                'special_status','special_status_reg_no',
                'special_status_start_date','special_status_end_date',
            ]);
        });
    }
};
