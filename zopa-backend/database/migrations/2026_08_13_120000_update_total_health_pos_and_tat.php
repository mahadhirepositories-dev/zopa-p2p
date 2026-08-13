<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\PurchaseOrder;
use App\Models\TatRecord;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $poData = [
            'TH/2026-27/49' => ['delivered_date' => '2026-07-08', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/50' => ['delivered_date' => '2026-07-12', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/51' => ['delivered_date' => '2026-07-20', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/52' => ['delivered_date' => '2026-07-18', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/53' => ['delivered_date' => '2026-07-18', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/54' => ['delivered_date' => '2026-07-16', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/55' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/56' => ['delivered_date' => '2026-07-27', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/57' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/58' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/59' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/60' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/61' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/62' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/63' => ['delivered_date' => '2026-07-21', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/64' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/65' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/66' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/67' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/68' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/69' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/70' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/71' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/72' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/73' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/74' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/75' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/76' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/77' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/80' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/81' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/82' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/83' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/87' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/88' => ['delivered_date' => '2026-07-31', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/89' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/90' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/91' => ['delivered_date' => '2026-07-31', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/92' => ['delivered_date' => '2026-07-31', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/93' => ['delivered_date' => '2026-07-31', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/94' => ['delivered_date' => '2026-07-31', 'status' => 'fully_delivered', 'delivery_status' => 'fully_delivered'],
            'TH/2026-27/95' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
            'TH/2026-27/96' => ['delivered_date' => null,         'status' => 'sent_to_vendor',  'delivery_status' => 'in_transit'],
        ];

        foreach ($poData as $poNumber => $info) {
            $po = DB::table('purchase_orders')->where('po_number', $poNumber)->first();
            if (!$po) {
                continue;
            }

            $releasedAt = $po->released_at ?? $po->approved_at ?? $po->created_at;
            $deliveredAt = $info['delivered_date'] ? $info['delivered_date'] . ' 18:00:00' : null;

            // 1. Update purchase_orders table
            $poUpdate = [
                'released_at'     => $releasedAt,
                'status'          => $info['status'],
                'delivery_status' => $info['delivery_status'],
            ];

            if ($deliveredAt) {
                $poUpdate['delivered_at'] = $deliveredAt;
            }

            DB::table('purchase_orders')->where('id', $po->id)->update($poUpdate);

            // 2. Update tat_records table
            $tat = DB::table('tat_records')->where('po_id', $po->id)->first();
            if ($tat) {
                $tatUpdate = [
                    'po_released_at' => $releasedAt,
                ];
                if ($deliveredAt) {
                    $tatUpdate['po_delivered_at'] = $deliveredAt;
                }
                DB::table('tat_records')->where('id', $tat->id)->update($tatUpdate);
            } else {
                $tatInsert = [
                    'po_id'           => $po->id,
                    'pr_id'           => $po->pr_id,
                    'po_created_at'   => $po->created_at,
                    'po_approved_at'  => $po->approved_at ?? $po->created_at,
                    'po_released_at'  => $releasedAt,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ];
                if ($deliveredAt) {
                    $tatInsert['po_delivered_at'] = $deliveredAt;
                }
                DB::table('tat_records')->insert($tatInsert);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data migration — no rollback required
    }
};
