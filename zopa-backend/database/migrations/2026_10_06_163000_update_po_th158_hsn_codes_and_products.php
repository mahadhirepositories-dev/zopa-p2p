<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Total Health | PO TH/2026-27/158:
     * Update HSN codes for line items to 300490 based on user request:
     * - TH608: Ibuprofen 400mg Tab -> 300490 (Sl 3)
     * - TH609: Dicyclomine 20mgTablet -> 300490 (Sl 16)
     * - TH610: Salbutamol Inhaler -> 300490 (Sl 30)
     * - TH404: BUDESONIDE 0.5 MG/ML -> 300490 (Sl 31)
     * - TH611: Ipratropium Respules -> 300490 (Sl 32)
     * - TH612: Normal Saline 500ml -> 300490 (Sl 34)
     * - TH613: Sodium Cromoglycate drops -> 300490 (Sl 39)
     * - TH615 / Glimepride 1mg Tab -> 300490 (Sl 53)
     * Also update master products table and sync any remaining missing HSN on PO-158.
     */
    public function up(): void
    {
        $hsnCode = '300490';

        // 1. Find PO TH/2026-27/158
        $pos = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/158')
                  ->orWhere('po_number', 'LIKE', '%TH%158%')
                  ->orWhere('po_number', 'LIKE', '%/158');
            })
            ->get();

        echo "Found {$pos->count()} matching PO(s) for TH/2026-27/158.\n";

        $targetCodes = [
            'TH608', 'TH609', 'TH610', 'TH404',
            'TH611', 'TH612', 'TH613', 'TH614', 'TH615'
        ];

        foreach ($pos as $po) {
            $poId = $po->id;
            echo "Processing PO ID {$poId} ({$po->po_number})...\n";

            // Update items by product_code
            $updatedByCode = DB::table('po_items')
                ->where('po_id', $poId)
                ->whereIn('product_code', $targetCodes)
                ->update([
                    'hsn_code'   => $hsnCode,
                    'updated_at' => now(),
                ]);
            echo "Updated {$updatedByCode} items by product code on PO {$poId}.\n";

            // Update items by sno matching the PDF line numbers
            $targetSno = [3, 16, 30, 31, 32, 34, 39, 53];
            $updatedBySno = DB::table('po_items')
                ->where('po_id', $poId)
                ->whereIn('sno', $targetSno)
                ->update([
                    'hsn_code'   => $hsnCode,
                    'updated_at' => now(),
                ]);
            echo "Updated {$updatedBySno} items by sno on PO {$poId}.\n";

            // Update items by description/name match
            $targetKeywords = [
                'Ibuprofen', 'Dicyclomine', 'Salbutamol Inhaler', 'BUDESONIDE',
                'Ipratropium', 'Normal Saline 500', 'Sodium Cromoglycate', 'Glimepride'
            ];
            foreach ($targetKeywords as $kw) {
                DB::table('po_items')
                    ->where('po_id', $poId)
                    ->where(function ($q) use ($kw) {
                        $q->where('description', 'LIKE', "%{$kw}%")
                          ->orWhere('product_name', 'LIKE', "%{$kw}%");
                    })
                    ->update([
                        'hsn_code'   => $hsnCode,
                        'updated_at' => now(),
                    ]);
            }

            // Universal safeguard: Any remaining items on this PO with missing/blank HSN
            $updatedBlank = DB::table('po_items')
                ->where('po_id', $poId)
                ->where(function ($q) {
                    $q->whereNull('hsn_code')
                      ->orWhere('hsn_code', '')
                      ->orWhere('hsn_code', '—');
                })
                ->update([
                    'hsn_code'   => $hsnCode,
                    'updated_at' => now(),
                ]);
            echo "Updated {$updatedBlank} remaining blank HSN items on PO {$poId}.\n";

            // If po_items link to product_id, ensure those products also have HSN updated
            $linkedProductIds = DB::table('po_items')
                ->where('po_id', $poId)
                ->whereNotNull('product_id')
                ->pluck('product_id')
                ->toArray();

            if (!empty($linkedProductIds)) {
                DB::table('products')
                    ->whereIn('id', $linkedProductIds)
                    ->where(function ($q) {
                        $q->whereNull('hsn_code')
                          ->orWhere('hsn_code', '')
                          ->orWhere('hsn_code', '—');
                    })
                    ->update([
                        'hsn_code'   => $hsnCode,
                        'updated_at' => now(),
                    ]);
            }

            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $po->tenant_id ?: 2,
                    'entity_type' => 'PO',
                    'entity_id'   => $po->id,
                    'user_id'     => $po->created_by ?: 1,
                    'action'      => 'hsn_codes_updated',
                    'meta'        => json_encode([
                        'po_id'       => $po->id,
                        'po_number'   => $po->po_number,
                        'description' => 'Updated line items HSN code to 300490 for TH608, TH609, TH610, TH404, TH611, TH612, TH613, TH615',
                        'hsn_code'    => $hsnCode,
                    ]),
                    'created_at'  => now(),
                ]);
            }
        }

        // 2. Also update master products catalog for Total Health & system-wide matching products
        $updatedMaster = DB::table('products')
            ->where(function ($q) use ($targetCodes) {
                $q->whereIn('code', $targetCodes)
                  ->orWhere('name', 'LIKE', '%Ibuprofen 400%')
                  ->orWhere('name', 'LIKE', '%Dicyclomine 20%')
                  ->orWhere('name', 'LIKE', '%Salbutamol Inhaler%')
                  ->orWhere('name', 'LIKE', '%BUDESONIDE 0.5%')
                  ->orWhere('name', 'LIKE', '%Ipratropium%')
                  ->orWhere('name', 'LIKE', '%Normal Saline 500%')
                  ->orWhere('name', 'LIKE', '%Sodium Cromoglycate%')
                  ->orWhere('name', 'LIKE', '%Glimepride 1mg%');
            })
            ->update([
                'hsn_code'   => $hsnCode,
                'updated_at' => now(),
            ]);

        echo "Updated {$updatedMaster} master product record(s) to HSN {$hsnCode}.\n";

        Cache::flush();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
