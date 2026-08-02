<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE purchase_requisitions MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'draft'");
        DB::statement("ALTER TABLE purchase_orders MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'draft'");
        DB::statement("ALTER TABLE grns MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'draft'");
        DB::statement("ALTER TABLE invoices MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
    }
};
