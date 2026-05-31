<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * role_permissions: defines what each named role may do in each module.
 *
 * This table is intentionally separate from Spatie's permission tables to
 * avoid any conflict with the existing HasRoles trait on User. It stores
 * coarse CRUD flags per (role, module) pair and is managed exclusively by
 * ZOPA Super Admin through the Access Control admin screen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('role', 60);    // e.g. 'client_buyer'
            $table->string('module', 60);  // e.g. 'purchase_orders'
            $table->boolean('can_view')->default(false);
            $table->boolean('can_create')->default(false);
            $table->boolean('can_edit')->default(false);
            $table->boolean('can_delete')->default(false);
            $table->timestamps();

            $table->unique(['role', 'module']);
            $table->index('role');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
