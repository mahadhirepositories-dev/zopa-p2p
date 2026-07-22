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
        // First, drop the check constraint if we are on SQLite (not applicable usually, but safe)
        // For MySQL, we can just alter it to VARCHAR.
        DB::statement('ALTER TABLE user_tenant_roles MODIFY role VARCHAR(60) NOT NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // We can't really safely revert to ENUM because we might have custom roles now.
        // So we will just leave it as VARCHAR in the down method, or do nothing.
    }
};
