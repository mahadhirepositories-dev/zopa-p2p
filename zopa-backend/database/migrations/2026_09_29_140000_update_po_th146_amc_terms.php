<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Total Health | PO TH/2026-27/146:
     * - Update Point 4 in Special Terms & Conditions:
     *   "4. AMC: Additional ECG@ 33/-. AMC 12% per annum on ECG machine’s purchase cost (i.e Rs 39357/-) will be applicable upon completion of initial 2-year warranty period."
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

        // 2. Locate target PO TH/2026-27/146
        $pos = DB::table('purchase_orders')
            ->where(function ($q) use ($tenantId) {
                if ($tenantId) {
                    $q->where('tenant_id', $tenantId);
                }
            })
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/146')
                  ->orWhere('po_number', 'LIKE', '%TH%146%')
                  ->orWhere('po_number', 'LIKE', '%2026-27/146%')
                  ->orWhere('po_number', 'LIKE', '%/146')
                  ->orWhere('id', 146);
            })
            ->get();

        $targetPoint4 = "4. AMC: Additional ECG@ 33/-. AMC 12% per annum on ECG machine’s purchase cost (i.e Rs 39357/-) will be applicable upon completion of initial 2-year warranty period.";

        foreach ($pos as $po) {
            $terms = $po->terms_conditions ?? '';
            $updatedTerms = $terms;

            // Pattern 1: Match standard numbered point 4 starting with "4. AMC:" up to line break or tag
            if (preg_match('/(^|[\r\n]+|<br\s*\/?>|<p[^>]*>|<li>)\s*4\.\s*AMC:.*?(?=\r|\n|<\/p>|<\/li>|<br|$)/is', $terms)) {
                $updatedTerms = preg_replace(
                    '/(^|[\r\n]+|<br\s*\/?>|<p[^>]*>|<li>)\s*4\.\s*AMC:.*?(?=\r|\n|<\/p>|<\/li>|<br|$)/is',
                    '${1}' . $targetPoint4,
                    $terms
                );
            }
            // Pattern 2: Match any clause containing "6% AMC upfront paid for 2-year Extended warranty"
            elseif (stripos($terms, '6% AMC upfront paid') !== false) {
                $updatedTerms = preg_replace(
                    '/6%\s*AMC\s*upfront\s*paid\s*for\s*2-year\s*Extended\s*warranty\.?/i',
                    'AMC 12% per annum on ECG machine’s purchase cost (i.e Rs 39357/-) will be applicable upon completion of initial 2-year warranty period.',
                    $terms
                );
            }
            // Pattern 3: If Point 4 is missing, insert after Point 3 (QUALITY & WARRANTY)
            elseif (preg_match('/(3\.\s*QUALITY\s*&\s*WARRANTY:.*?(?:\r?\n\r?\n|\r?\n|<\/p>|<\/li>|<br\s*\/?>|$))/is', $terms, $matches)) {
                $updatedTerms = str_replace(
                    $matches[1],
                    $matches[1] . "\n\n" . $targetPoint4,
                    $terms
                );
            }
            // Pattern 4: Fallback append to end
            else {
                $updatedTerms = trim($terms) . "\n\n" . $targetPoint4;
            }

            DB::table('purchase_orders')->where('id', $po->id)->update([
                'terms_conditions' => $updatedTerms,
                'updated_at'       => now(),
            ]);

            // Activity Log
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $po->tenant_id ?: $tenantId,
                    'entity_type' => 'PO',
                    'entity_id'   => $po->id,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'terms_conditions_updated',
                    'meta'        => json_encode([
                        'po_number'   => $po->po_number,
                        'description' => 'Updated Point 4 Special Terms (AMC 12% per annum on ECG machine purchase cost Rs 39357/-)',
                        'point_4'     => $targetPoint4,
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
