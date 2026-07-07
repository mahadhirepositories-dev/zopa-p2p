<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('purchase_orders')
            ->whereIn('po_number', ['TH/2026-27/48', '2601/02/TOTALHEALTH-PO-2026-0001'])
            ->update(['po_number' => 'TH/2026-27/49']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('purchase_orders')
            ->where('po_number', 'TH/2026-27/49')
            ->update(['po_number' => 'TH/2026-27/48']);
    }
};
