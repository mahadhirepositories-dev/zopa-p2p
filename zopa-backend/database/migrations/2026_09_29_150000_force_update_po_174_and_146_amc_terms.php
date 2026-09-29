<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Total Health | PO 174 & PO TH/2026-27/146:
     * - Force update Point 4 in Special Terms & Conditions across PO 174, PO 146, and any PO matching ECG terms.
     * - Target text:
     *   "4. AMC: 12% per annum on ECG machine’s purchase cost will be applicable upon completion of initial 2-year warranty period."
     */
    public function up(): void
    {
        $targetPoint4 = "4. AMC: 12% per annum on ECG machine’s purchase cost will be applicable upon completion of initial 2-year warranty period.";

        // Match by ID (174, 146), po_number (146, 174), or terms containing ECG/AMC
        $pos = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->whereIn('id', [174, 146])
                  ->orWhere('po_number', 'TH/2026-27/146')
                  ->orWhere('po_number', 'TH/2026-27/174')
                  ->orWhere('po_number', 'LIKE', '%146%')
                  ->orWhere('po_number', 'LIKE', '%174%')
                  ->orWhere('terms_conditions', 'LIKE', '%ECG%')
                  ->orWhere('terms_conditions', 'LIKE', '%Additional ECG%');
            })
            ->get();

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
            // Pattern 2: Match any clause containing "ECG machine" and "purchase cost"
            elseif (stripos($terms, 'purchase cost') !== false && stripos($terms, 'ECG') !== false) {
                $updatedTerms = preg_replace(
                    '/(^|[\r\n]+)\s*4\..*?(?=\r|\n|$)/is',
                    '${1}' . $targetPoint4,
                    $terms
                );
            }
            // Pattern 3: Fallback if Point 4 exists with any other prefix
            elseif (preg_match('/(^|[\r\n]+)\s*4\..*?(?=\r|\n|$)/is', $terms)) {
                $updatedTerms = preg_replace(
                    '/(^|[\r\n]+)\s*4\..*?(?=\r|\n|$)/is',
                    '${1}' . $targetPoint4,
                    $terms
                );
            }

            DB::table('purchase_orders')->where('id', $po->id)->update([
                'terms_conditions' => $updatedTerms,
                'updated_at'       => now(),
            ]);

            // Activity Log
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $po->tenant_id ?: 2,
                    'entity_type' => 'PO',
                    'entity_id'   => $po->id,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'terms_conditions_updated',
                    'meta'        => json_encode([
                        'po_id'       => $po->id,
                        'po_number'   => $po->po_number,
                        'description' => 'Force updated Point 4 Special Terms for PO 174/146',
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
