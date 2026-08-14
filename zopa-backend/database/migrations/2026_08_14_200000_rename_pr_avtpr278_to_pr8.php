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
        // 1. Find Apollo Isha Vidhya Niketan tenant
        $tenant = DB::table('tenants')
            ->where('name', 'like', '%Isha%')
            ->orWhere('name', 'like', '%Vidhya%')
            ->orWhere('name', 'like', '%Niketan%')
            ->orWhere('name', 'like', '%Nikethan%')
            ->first();

        if (!$tenant) {
            return;
        }

        // 2. Find the PR in this tenant matching AVTPR2026-278
        $pr = DB::table('purchase_requisitions')
            ->where('tenant_id', $tenant->id)
            ->where(function ($query) {
                $query->where('pr_number', 'AVTPR2026-278')
                      ->orWhere('pr_number', 'AVTPR/2026-27/8')
                      ->orWhere('pr_number', 'AVTPR2026-27/8')
                      ->orWhere('pr_number', 'AVTPR-2026-278')
                      ->orWhere('pr_number', 'like', '%AVTPR%8%')
                      ->orWhere('pr_number', 'like', '%278%');
            })
            ->first();

        if (!$pr) {
            // Fallback search across all tenants if tenant id differed
            $pr = DB::table('purchase_requisitions')
                ->where('pr_number', 'AVTPR2026-278')
                ->orWhere('pr_number', 'like', '%AVTPR%8%')
                ->first();
        }

        if ($pr) {
            // Update PR number to PR8 to fit the PR1, PR2... PR7 series
            DB::table('purchase_requisitions')
                ->where('id', $pr->id)
                ->update([
                    'pr_number' => 'PR8',
                    'pr_ref'    => 'PR8',
                ]);

            // Update any linked POs referencing this PR number
            DB::table('purchase_orders')
                ->where('pr_id', $pr->id)
                ->update([
                    'pr_reference' => 'PR8',
                ]);
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
