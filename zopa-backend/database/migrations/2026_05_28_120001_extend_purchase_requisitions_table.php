<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add pr_number unique per tenant
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->string('pr_number')->nullable()->after('pr_ref');
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete()->after('cost_center_id');
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete()->after('project_id');
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal')->after('location_id');
            $table->date('required_by_date')->nullable()->after('priority');
            $table->foreignId('buyer_id')->nullable()->constrained('users')->nullOnDelete()->after('requested_by');
            $table->timestamp('converted_at')->nullable()->after('submitted_at');
        });

        // Extend status ENUM to include 'converted'
        DB::statement("ALTER TABLE purchase_requisitions MODIFY status ENUM('draft','submitted','converted','rejected') NOT NULL DEFAULT 'draft'");

        // Composite unique: tenant_id + pr_number
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->unique(['tenant_id', 'pr_number'], 'pr_tenant_pr_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropUnique('pr_tenant_pr_number_unique');
            $table->dropColumn(['pr_number', 'project_id', 'location_id', 'priority', 'required_by_date', 'buyer_id', 'converted_at']);
        });
        DB::statement("ALTER TABLE purchase_requisitions MODIFY status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft'");
    }
};
