<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Delete all auto-drafted dummy pending GRNs and their items
        $pendingGrnIds = DB::table('grns')->where('status', 'pending')->pluck('id');
        if ($pendingGrnIds->isNotEmpty()) {
            DB::table('grn_items')->whereIn('grn_id', $pendingGrnIds)->delete();
            DB::table('grns')->whereIn('id', $pendingGrnIds)->delete();
        }
    }

    public function down(): void
    {
        // Non-reversible data cleanup
    }
};
