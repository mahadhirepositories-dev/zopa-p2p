<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Form Templates
        Schema::create('vendor_form_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('name');
            $table->string('vendor_type')->nullable(); // manufacturer, distributor, service_provider, consultant
            $table->text('description')->nullable();
            $table->json('schema_definition');
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 2. Onboarding Invitations (Single-use tokenized links)
        Schema::create('vendor_onboarding_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('form_template_id')->constrained('vendor_form_templates')->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('vendor_name')->nullable();
            $table->string('vendor_email');
            $table->string('phone', 30)->nullable();
            $table->enum('status', ['pending', 'submitted', 'expired'])->default('pending');
            $table->dateTime('expires_at');
            $table->dateTime('submitted_at')->nullable();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        // 3. Responses (Staging queue before P2P promotion)
        Schema::create('vendor_onboarding_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invite_id')->constrained('vendor_onboarding_invites')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('form_template_id')->constrained('vendor_form_templates')->cascadeOnDelete();
            $table->json('form_snapshot');
            $table->json('form_data');
            $table->enum('status', ['pending_review', 'approved', 'rejected'])->default('pending_review');
            $table->text('admin_notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('approved_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('rejected_at')->nullable();
            $table->foreignId('created_vendor_id')->nullable()->constrained('vendors')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        // 4. Attachments (Uploaded files: PAN, GST, Cheque, Certs)
        Schema::create('vendor_onboarding_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('response_id')->constrained('vendor_onboarding_responses')->cascadeOnDelete();
            $table->string('field_key');
            $table->string('document_type')->nullable(); // pan, gst, cancelled_cheque, additional
            $table->string('file_name');
            $table->string('original_name');
            $table->string('file_path');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });

        // Seed default templates
        $this->seedDefaultTemplates();
    }

    private function seedDefaultTemplates(): void
    {
        $defaultFieldsGoods = [
            [
                'id'             => 'f_name',
                'field_key'      => 'name',
                'label'          => 'Company / Vendor Legal Name',
                'type'           => 'text',
                'required'       => true,
                'placeholder'    => 'e.g. Acme Industrial Supplies Pvt Ltd',
                'help_text'      => 'As registered with GST / Income Tax department',
                'target_mapping' => 'name',
            ],
            [
                'id'             => 'f_vendor_type',
                'field_key'      => 'vendor_type',
                'label'          => 'Vendor Business Type',
                'type'           => 'select',
                'required'       => true,
                'options'        => ['manufacturer', 'distributor', 'service_provider', 'consultant'],
                'target_mapping' => 'vendor_type',
            ],
            [
                'id'             => 'f_entity_type',
                'field_key'      => 'entity_type',
                'label'          => 'Entity Legal Structure',
                'type'           => 'select',
                'required'       => true,
                'options'        => ['pvt_ltd', 'public', 'llp', 'partnership', 'individual', 'others'],
                'target_mapping' => 'entity_type',
            ],
            [
                'id'             => 'f_email',
                'field_key'      => 'email',
                'label'          => 'Official Email Address',
                'type'           => 'email',
                'required'       => true,
                'placeholder'    => 'orders@vendor.com',
                'target_mapping' => 'email',
            ],
            [
                'id'             => 'f_phone',
                'field_key'      => 'phone',
                'label'          => 'Primary Contact Phone',
                'type'           => 'phone',
                'required'       => true,
                'placeholder'    => '+91 9876543210',
                'target_mapping' => 'phone',
            ],
            [
                'id'             => 'f_pan',
                'field_key'      => 'pan',
                'label'          => 'Permanent Account Number (PAN)',
                'type'           => 'text',
                'required'       => true,
                'placeholder'    => 'ABCDE1234F',
                'help_text'      => '10-character alphanumeric PAN',
                'target_mapping' => 'pan',
            ],
            [
                'id'             => 'f_pan_doc',
                'field_key'      => 'pan_doc',
                'label'          => 'PAN Card Copy (PDF/Image)',
                'type'           => 'file',
                'required'       => true,
                'target_doc_type'=> 'pan',
            ],
            [
                'id'             => 'f_gstin',
                'field_key'      => 'gstin',
                'label'          => 'GST Identification Number (GSTIN)',
                'type'           => 'text',
                'required'       => false,
                'placeholder'    => '29ABCDE1234F1Z5',
                'target_mapping' => 'gstin',
            ],
            [
                'id'             => 'f_gst_doc',
                'field_key'      => 'gst_doc',
                'label'          => 'GST Registration Certificate (PDF)',
                'type'           => 'file',
                'required'       => false,
                'target_doc_type'=> 'gst',
            ],
            [
                'id'             => 'f_special_status',
                'field_key'      => 'special_status',
                'label'          => 'Enterprise Classification',
                'type'           => 'select',
                'required'       => false,
                'options'        => ['msme', 'non_msme', 'sez', 'others'],
                'target_mapping' => 'special_status',
            ],
            [
                'id'             => 'f_account_no',
                'field_key'      => 'account_no',
                'label'          => 'Bank Account Number',
                'type'           => 'text',
                'required'       => true,
                'target_mapping' => 'account_no',
            ],
            [
                'id'             => 'f_ifsc',
                'field_key'      => 'ifsc',
                'label'          => 'Bank IFSC Code',
                'type'           => 'text',
                'required'       => true,
                'target_mapping' => 'ifsc',
            ],
            [
                'id'             => 'f_bank_name',
                'field_key'      => 'bank_name',
                'label'          => 'Bank Name & Branch',
                'type'           => 'text',
                'required'       => true,
                'target_mapping' => 'bank_name',
            ],
            [
                'id'             => 'f_cheque_doc',
                'field_key'      => 'cheque_doc',
                'label'          => 'Cancelled Cheque / Bank Letter (PDF/Image)',
                'type'           => 'file',
                'required'       => true,
                'target_doc_type'=> 'cancelled_cheque',
            ],
            [
                'id'             => 'f_address',
                'field_key'      => 'address',
                'label'          => 'Registered Office Address',
                'type'           => 'textarea',
                'required'       => true,
                'target_mapping' => 'address',
            ],
            [
                'id'             => 'f_city',
                'field_key'      => 'city',
                'label'          => 'City',
                'type'           => 'text',
                'required'       => true,
                'target_mapping' => 'city',
            ],
            [
                'id'             => 'f_state',
                'field_key'      => 'state',
                'label'          => 'State',
                'type'           => 'text',
                'required'       => true,
                'target_mapping' => 'state',
            ],
            [
                'id'             => 'f_pincode',
                'field_key'      => 'pincode',
                'label'          => 'Postal PIN Code',
                'type'           => 'text',
                'required'       => true,
                'target_mapping' => 'pincode',
            ],
        ];

        // 1. Standard Goods & Materials
        DB::table('vendor_form_templates')->insert([
            'name'              => 'Standard Goods & Materials Vendor Form',
            'vendor_type'       => 'distributor',
            'description'       => 'Standard registration template for suppliers of physical goods, consumables, raw materials, and machinery.',
            'schema_definition' => json_encode($defaultFieldsGoods),
            'is_active'         => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        // 2. Service Provider & Contractor Form
        $servicesFields = $defaultFieldsGoods;
        $servicesFields[] = [
            'id'             => 'f_service_scope',
            'field_key'      => 'service_scope',
            'label'          => 'Primary Services Offered',
            'type'           => 'textarea',
            'required'       => true,
            'placeholder'    => 'Briefly outline maintenance, facility, IT, or consulting services provided...',
            'target_mapping' => 'custom',
        ];
        $servicesFields[] = [
            'id'             => 'f_msme_cert',
            'field_key'      => 'msme_cert',
            'label'          => 'MSME / Udyam Certificate (If applicable)',
            'type'           => 'file',
            'required'       => false,
            'target_doc_type'=> 'additional',
        ];

        DB::table('vendor_form_templates')->insert([
            'name'              => 'Service Provider & Contractor Onboarding Form',
            'vendor_type'       => 'service_provider',
            'description'       => 'Onboarding template for service agencies, contractors, consulting firms, and facility management partners.',
            'schema_definition' => json_encode($servicesFields),
            'is_active'         => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        // 3. Healthcare & Medical Supplies Vendor Form
        $medicalFields = $defaultFieldsGoods;
        $medicalFields[] = [
            'id'             => 'f_drug_license',
            'field_key'      => 'drug_license_no',
            'label'          => 'Drug License Number (Form 20B/21B)',
            'type'           => 'text',
            'required'       => true,
            'placeholder'    => 'DL/XXXX/YYYY',
            'target_mapping' => 'custom',
        ];
        $medicalFields[] = [
            'id'             => 'f_drug_license_doc',
            'field_key'      => 'drug_license_doc',
            'label'          => 'Drug License Copy (PDF)',
            'type'           => 'file',
            'required'       => true,
            'target_doc_type'=> 'additional',
        ];

        DB::table('vendor_form_templates')->insert([
            'name'              => 'Healthcare & Medical Supplies Vendor Form',
            'vendor_type'       => 'distributor',
            'description'       => 'Specialized template for pharmaceutical, medical devices, diagnostics, and healthcare equipment distributors.',
            'schema_definition' => json_encode($medicalFields),
            'is_active'         => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_onboarding_attachments');
        Schema::dropIfExists('vendor_onboarding_responses');
        Schema::dropIfExists('vendor_onboarding_invites');
        Schema::dropIfExists('vendor_form_templates');
    }
};
