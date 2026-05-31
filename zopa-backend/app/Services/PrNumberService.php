<?php

namespace App\Services;

use App\Models\PurchaseRequisition;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

class PrNumberService
{
    public function generate(Tenant $tenant): string
    {
        $year    = now()->year;
        $orgCode = strtoupper(trim($tenant->code ?? 'ORG'));
        $prefix  = "{$orgCode}-PR-{$year}-";
        $like    = "{$prefix}%";

        return DB::transaction(function () use ($tenant, $prefix, $like) {
            $lastNumber = PurchaseRequisition::where('tenant_id', $tenant->id)
                ->whereNotNull('pr_number')
                ->where('pr_number', 'like', $like)
                ->lockForUpdate()
                ->max('pr_number');

            $seq = $lastNumber
                ? ((int) substr($lastNumber, strlen($prefix))) + 1
                : 1;

            return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
        });
    }
}
