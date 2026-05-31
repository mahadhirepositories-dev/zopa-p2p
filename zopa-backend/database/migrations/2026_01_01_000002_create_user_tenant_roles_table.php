<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_tenant_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->enum('role', [
                'zopa_super_admin',
                'zopa_buyer',
                'zopa_approver_l1',
                'zopa_approver_l2',
                'zopa_approver_l3',
                'client_admin',
                'client_buyer',
                'client_approver_l1',
                'client_approver_l2',
                'client_approver_l3',
            ]);
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'tenant_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_tenant_roles');
    }
};
