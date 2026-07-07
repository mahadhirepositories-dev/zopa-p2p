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

            $maxSeq = $poNumbers->map(function ($po) use ($prefix) {
                return (int) substr($po, strlen($prefix));
            })->max();

            $seq = $maxSeq ? $maxSeq + 1 : $startSeries;

            return $prefix . $seq;
        });
    }
}
