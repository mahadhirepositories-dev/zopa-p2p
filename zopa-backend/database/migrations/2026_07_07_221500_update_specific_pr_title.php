<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('purchase_requisitions')
            ->where('pr_number', '2601/02/TOTALHEALTH-PR-2026-0002')
            ->update(['title' => 'True Hb Strips']);
    }

    public function down(): void
    {
        // 
    }
};
