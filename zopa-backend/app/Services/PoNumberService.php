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
        $year    = now()->year;
        $orgCode = strtoupper(trim($tenant->code ?? 'ORG'));
        $prefix  = "{$orgCode}-PO-{$year}-";
        $like    = "{$prefix}%";

        return DB::transaction(function () use ($tenant, $prefix, $like) {
            $lastNumber = PurchaseOrder::where('tenant_id', $tenant->id)
                ->whereNotNull('po_number')
                ->where('po_number', 'like', $like)
                ->lockForUpdate()
                ->max('po_number');

            $seq = $lastNumber
                ? ((int) substr($lastNumber, strlen($prefix))) + 1
                : 1;

            return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
        });
    }
}
