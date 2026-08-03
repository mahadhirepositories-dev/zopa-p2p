<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_requisitions', 'needs_clarification')) {
                $table->boolean('needs_clarification')->default(false)->after('status');
                $table->timestamp('clarification_requested_at')->nullable()->after('needs_clarification');
                $table->foreignId('clarification_requested_by')->nullable()->constrained('users')->nullOnDelete()->after('clarification_requested_at');
                $table->timestamp('clarification_provided_at')->nullable()->after('clarification_requested_by');
                $table->foreignId('clarification_provided_by')->nullable()->constrained('users')->nullOnDelete()->after('clarification_provided_at');
                $table->unsignedInteger('total_clarification_duration_seconds')->default(0)->after('clarification_provided_by');
            }
        });

        if (!Schema::hasTable('pr_clarifications')) {
            Schema::create('pr_clarifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('pr_id')->constrained('purchase_requisitions')->cascadeOnDelete();
                $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
                $table->text('request_notes');
                $table->timestamp('requested_at');
                $table->foreignId('provided_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('response_notes')->nullable();
                $table->timestamp('provided_at')->nullable();
                $table->unsignedInteger('duration_seconds')->default(0);
                $table->string('status', 30)->default('pending'); // pending, resolved
                $table->timestamps();

                $table->index(['tenant_id', 'pr_id']);
            });
        }

        Schema::table('tat_records', function (Blueprint $table) {
            if (!Schema::hasColumn('tat_records', 'clarification_requested_at')) {
                $table->timestamp('clarification_requested_at')->nullable()->after('pr_submitted_at');
                $table->timestamp('clarification_provided_at')->nullable()->after('clarification_requested_at');
                $table->unsignedInteger('clarification_duration_seconds')->default(0)->after('clarification_provided_at');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pr_clarifications');
        
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropColumn([
                'needs_clarification',
                'clarification_requested_at',
                'clarification_requested_by',
                'clarification_provided_at',
                'clarification_provided_by',
                'total_clarification_duration_seconds',
            ]);
        });

        Schema::table('tat_records', function (Blueprint $table) {
            $table->dropColumn([
                'clarification_requested_at',
                'clarification_provided_at',
                'clarification_duration_seconds',
            ]);
        });
    }
};
