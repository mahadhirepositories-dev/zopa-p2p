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

            $maxSeq = 0;
            $padLen = 0;

            foreach ($prNumbers as $pr) {
                $numPart = substr($pr, strlen($prefix));
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
