<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

class PoNumberService
{
    /**
     * Generate the next sequential PO number for a tenant.
     * Format: {ORG_CODE}-PO-{YEAR}-{0001}  e.g. MHD-PO-2026-0001
     * Called on submit (not on create), so draft POs show "Draft" until sent for approval.
     */
    public function generate(Tenant $tenant): string
    {
        $prefix  = $tenant->po_prefix ?? 'PO-';
        $like    = "{$prefix}%";
        $startSeries = $tenant->po_starting_series ?? 1;

        return DB::transaction(function () use ($tenant, $prefix, $like, $startSeries) {
            $poNumbers = PurchaseOrder::where('tenant_id', $tenant->id)
                ->whereNotNull('po_number')
                ->where('po_number', 'like', $like)
                ->lockForUpdate()
                ->pluck('po_number');

            $maxSeq = 0;
            $padLen = 0;

            foreach ($poNumbers as $po) {
                $numPart = substr($po, strlen($prefix));
                if (is_numeric($numPart)) {
                    $val = (int) $numPart;
                    if ($val > $maxSeq) {
                        $maxSeq = $val;
                        if (strlen($numPart) > 1 && str_starts_with($numPart, '0')) {
                            $padLen = strlen($numPart);
                        }
                    }
                }
            }

            $seq = $maxSeq ? $maxSeq + 1 : $startSeries;
            $seqStr = $padLen ? str_pad((string)$seq, $padLen, '0', STR_PAD_LEFT) : (string)$seq;

            return $prefix . $seqStr;
        });
    }
}
