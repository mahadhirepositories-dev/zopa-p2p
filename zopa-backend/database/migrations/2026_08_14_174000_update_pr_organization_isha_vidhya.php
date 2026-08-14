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
        // 1. Find Apollo Isha Vidhya Nikethan tenant
        $tenant = DB::table('tenants')
            ->where('name', 'like', '%Isha%')
            ->orWhere('name', 'like', '%Vidhya%')
            ->orWhere('name', 'like', '%Nikethan%')
            ->first();

        if (!$tenant) {
            return;
        }

        // 2. Find target PR (AVTPR2026-278 or AVTPR/2026-27/8 or variations)
        $pr = DB::table('purchase_requisitions')
            ->where('pr_number', 'AVTPR2026-278')
            ->orWhere('pr_number', 'AVTPR/2026-27/8')
            ->orWhere('pr_number', 'AVTPR2026-27/8')
            ->orWhere('pr_number', 'AVTPR-2026-278')
            ->orWhere('pr_number', 'AVTPR/2026-27/08')
            ->orWhere(function ($query) {
                $query->where('pr_number', 'like', '%AVTPR%')
                      ->where(function ($q) {
                          $q->where('pr_number', 'like', '%278%')
                            ->orWhere('pr_number', 'like', '%27/8%')
                            ->orWhere('pr_number', 'like', '%27/08%');
                      });
            })
            ->first();

        if ($pr) {
            // Update PR tenant_id
            DB::table('purchase_requisitions')
                ->where('id', $pr->id)
                ->update(['tenant_id' => $tenant->id]);

            // Update any linked POs if applicable
            DB::table('purchase_orders')
                ->where('pr_id', $pr->id)
                ->update(['tenant_id' => $tenant->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op for data patch
    }
};
