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
        if (!Schema::hasTable('pr_status_updates')) {
            Schema::create('pr_status_updates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->foreignId('pr_id')->constrained('purchase_requisitions')->cascadeOnDelete();
                $table->foreignId('sent_by')->constrained('users')->cascadeOnDelete();
                $table->text('message');
                $table->json('cc_emails')->nullable();
                $table->json('attachments')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pr_status_updates');
    }
};
