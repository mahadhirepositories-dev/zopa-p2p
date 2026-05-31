<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cost_center_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('level'); // 1, 2, 3
            $table->foreignId('user_id')->constrained();
            $table->decimal('amount_limit', 15, 2)->nullable(); // null = no limit (final level)
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['cost_center_id', 'level']);
        });

        Schema::create('approvals', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 20); // PO | PR
            $table->unsignedBigInteger('entity_id');
            $table->unsignedTinyInteger('level');
            $table->foreignId('assigned_to_user_id')->constrained('users');
            $table->enum('action', ['pending', 'approved', 'returned', 'rejected'])->default('pending');
            $table->text('comments')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();

            $table->index(['entity_type', 'entity_id']);
            $table->index(['assigned_to_user_id', 'action']);
        });

        Schema::create('email_action_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->foreignId('approval_id')->constrained('approvals')->cascadeOnDelete();
            $table->enum('action', ['approve', 'revise']);
            $table->foreignId('approver_id')->constrained('users');
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_action_tokens');
        Schema::dropIfExists('approvals');
        Schema::dropIfExists('approval_configs');
    }
};
