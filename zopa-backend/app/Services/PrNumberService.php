<?php

namespace App\Services;

use App\Models\PurchaseRequisition;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

class PrNumberService
{
    public function generate(Tenant $tenant): string
    {
        $prefix  = $tenant->pr_prefix ?? 'PR-';
        $like    = "{$prefix}%";
        $startSeries = $tenant->pr_starting_series ?? 1;

        return DB::transaction(function () use ($tenant, $prefix, $like, $startSeries) {
            $prNumbers = PurchaseRequisition::where('tenant_id', $tenant->id)
                ->whereNotNull('pr_number')
                ->where('pr_number', 'like', $like)
                ->lockForUpdate()
                ->pluck('pr_number');

            $maxSeq = $prNumbers->map(function ($pr) use ($prefix) {
                return (int) substr($pr, strlen($prefix));
            })->max();

            $seq = $maxSeq ? $maxSeq + 1 : $startSeries;

            return $prefix . $seq;
        });
    }
}
