<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Extend status ENUM to include rfq_created and rfq_approved
        DB::statement("
            ALTER TABLE purchase_requisitions
              MODIFY COLUMN status ENUM('draft','submitted','rfq_created','rfq_approved','converted','rejected')
                NOT NULL DEFAULT 'draft',
              ADD COLUMN required_by_person VARCHAR(255) NULL AFTER required_by_date
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE purchase_requisitions
              MODIFY COLUMN status ENUM('draft','submitted','converted','rejected')
                NOT NULL DEFAULT 'draft'
        ");
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropColumn('required_by_person');
        });
    }
};
