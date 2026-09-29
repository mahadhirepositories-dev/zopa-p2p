<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Total Health | PO TH/2026-27/147:
     * - Update Payment Terms to 100% Advance
     * - Stage: Advance, Percentage: 100, Credit Days: 0
     */
    public function up(): void
    {
        // 1. Locate Total Health tenant
        $tenant = DB::table('tenants')
            ->where('name', 'LIKE', '%Total Health%')
            ->orWhere('name', 'LIKE', '%TOTAL HEALTH%')
            ->orWhere('code', 'LIKE', '%TH%')
            ->first();

        $tenantId = $tenant?->id;

        // 2. Locate target PO TH/2026-27/147
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($tenantId) {
                if ($tenantId) {
                    $q->where('tenant_id', $tenantId);
                }
            })
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/147')
                  ->orWhere('po_number', 'LIKE', '%TH%147%')
                  ->orWhere('po_number', 'LIKE', '%2026-27/147%')
                  ->orWhere('po_number', 'LIKE', '%/147')
                  ->orWhere('id', 147);
            })
            ->get();

        $paymentTerms = [
            [
                'stage'       => 'Advance',
                'percentage'  => 100,
                'credit_days' => 0,
            ],
        ];

        foreach ($pos as $po) {
            DB::table('purchase_orders')->where('id', $po->id)->update([
                'payment_terms_json' => json_encode($paymentTerms),
                'updated_at'         => now(),
            ]);

            // Activity Log
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $po->tenant_id ?: $tenantId,
                    'entity_type' => 'PO',
                    'entity_id'   => $po->id,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'payment_terms_updated',
                    'meta'        => json_encode([
                        'po_number'     => $po->po_number,
                        'description'   => 'Payment schedule updated to 100% Advance',
                        'payment_terms' => $paymentTerms,
                    ]),
                    'created_at'  => now(),
                ]);
            }
        }

        Cache::flush();
    }

    public function down(): void
    {
    }
};
