<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Total Health | PO 174 & PO 146:
     * Strictly update Point 4 in Special Terms & Conditions:
     * Target: "4. AMC: 12% per annum on ECG machine’s purchase cost will be applicable upon completion of initial 2-year warranty period."
     * Completely remove:
     * - "Additional ECG@ 33/-."
     * - "(i.e Rs 39357/-)"
     */
    public function up(): void
    {
        $targetPoint4 = "4. AMC: 12% per annum on ECG machine’s purchase cost will be applicable upon completion of initial 2-year warranty period.";

        $pos = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->whereIn('id', [174, 146])
                  ->orWhere('po_number', 'LIKE', '%146%')
                  ->orWhere('po_number', 'LIKE', '%174%')
                  ->orWhere('terms_conditions', 'LIKE', '%ECG%')
                  ->orWhere('terms_conditions', 'LIKE', '%39357%')
                  ->orWhere('terms_conditions', 'LIKE', '%Additional ECG%');
            })
            ->get();

        echo "Found {$pos->count()} PO(s) to update for AMC terms.\n";

        $pattern = '/(<(?:p|div|li)[^>]*>|[\r\n]+|^)\s*4\.(?:&nbsp;|\s)*AMC\s*:(?:&nbsp;|\s)*.*?(?=(?:<(?:p|div|li)[^>]*>|[\r\n]+|\s*<br\s*\/?>\s*)?(?:5\.(?:&nbsp;|\s)*PAYMENT|<\/(?:p|div|li)>|$))/is';

        foreach ($pos as $po) {
            $terms = $po->terms_conditions ?? '';
            $original = $terms;
            $updated = $terms;

            if (preg_match($pattern, $updated)) {
                $updated = preg_replace($pattern, '${1}' . $targetPoint4, $updated, 1);
            }

            // Universal fallback cleanup: eliminate any remnant of Additional ECG@ 33/- or the price tag
            $updated = preg_replace('/Additional\s*ECG\s*@\s*33\s*\/?\s*-\s*\.?\s*/i', '', $updated);
            $updated = preg_replace('/\s*\(i\.?e\.?\s*Rs\.?\s*39357\s*\/?\s*-\s*\)/i', '', $updated);
            $updated = preg_replace('/AMC\s*:\s*(?:&nbsp;|\s)*AMC\s+/i', 'AMC: ', $updated);

            if ($updated !== $original) {
                DB::table('purchase_orders')->where('id', $po->id)->update([
                    'terms_conditions' => $updated,
                    'updated_at'       => now(),
                ]);
                echo "Successfully updated PO ID {$po->id} ({$po->po_number}).\n";
            } else {
                // If regex didn't change it, directly replace point 4 text
                $forced = str_replace(
                    "Additional ECG@ 33/-. AMC 12% per annum on ECG machine's purchase cost (i.e Rs 39357/-) will be applicable upon completion of initial 2-year warranty period.",
                    "12% per annum on ECG machine’s purchase cost will be applicable upon completion of initial 2-year warranty period.",
                    $terms
                );
                $forced = str_replace(
                    "Additional ECG@ 33/-. AMC 12% per annum on ECG machine’s purchase cost (i.e Rs 39357/-) will be applicable upon completion of initial 2-year warranty period.",
                    "12% per annum on ECG machine’s purchase cost will be applicable upon completion of initial 2-year warranty period.",
                    $forced
                );
                DB::table('purchase_orders')->where('id', $po->id)->update([
                    'terms_conditions' => $forced,
                    'updated_at'       => now(),
                ]);
                echo "Force string-replaced PO ID {$po->id} ({$po->po_number}).\n";
            }

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
                        'description' => 'Strictly updated Point 4 AMC terms on PO 174',
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
