<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Fix ENUM: was ['approve','revise'] — code uses 'return' and 'reject'
        DB::statement("ALTER TABLE email_action_tokens MODIFY COLUMN action ENUM('approve','return','reject') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE email_action_tokens MODIFY COLUMN action ENUM('approve','revise') NOT NULL");
    }
};
