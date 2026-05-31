<?php

namespace App\Services;

use App\Models\BudgetLedger;
use App\Models\CostCenter;
use Illuminate\Support\Facades\DB;

class BudgetService
{
    public function getAvailable(int $costCenterId, int $fiscalYear): array
    {
        $cc = CostCenter::findOrFail($costCenterId);

        $agg = BudgetLedger::where('cost_center_id', $costCenterId)
            ->where('fiscal_year', $fiscalYear)
            ->selectRaw('
                SUM(CASE WHEN action = "freeze" THEN freeze_amount ELSE 0 END)
              - SUM(CASE WHEN action = "release" THEN freeze_amount ELSE 0 END) AS total_frozen,
                SUM(CASE WHEN action = "consume" THEN consume_amount ELSE 0 END) AS total_consumed
            ')
            ->first();

        $frozen = (float) ($agg->total_frozen ?? 0);
        $consumed = (float) ($agg->total_consumed ?? 0);
        $annual = (float) $cc->annual_budget;
        $available = $annual - $frozen - $consumed;

        return compact('annual', 'frozen', 'consumed', 'available');
    }

    public function freeze(int $costCenterId, int $fiscalYear, float $amount, string $refType, int $refId, int $createdBy, string $narration = ''): void
    {
        BudgetLedger::create([
            'cost_center_id' => $costCenterId,
            'fiscal_year' => $fiscalYear,
            'reference_type' => $refType,
            'reference_id' => $refId,
            'freeze_amount' => $amount,
            'consume_amount' => 0,
            'action' => 'freeze',
            'narration' => $narration,
            'created_by' => $createdBy,
        ]);
    }

    public function release(int $costCenterId, int $fiscalYear, float $amount, string $refType, int $refId, int $createdBy, string $narration = ''): void
    {
        BudgetLedger::create([
            'cost_center_id' => $costCenterId,
            'fiscal_year' => $fiscalYear,
            'reference_type' => $refType,
            'reference_id' => $refId,
            'freeze_amount' => $amount,
            'consume_amount' => 0,
            'action' => 'release',
            'narration' => $narration,
            'created_by' => $createdBy,
        ]);
    }

    public function consume(int $costCenterId, int $fiscalYear, float $amount, string $refType, int $refId, int $createdBy, string $narration = ''): void
    {
        BudgetLedger::create([
            'cost_center_id' => $costCenterId,
            'fiscal_year' => $fiscalYear,
            'reference_type' => $refType,
            'reference_id' => $refId,
            'freeze_amount' => 0,
            'consume_amount' => $amount,
            'action' => 'consume',
            'narration' => $narration,
            'created_by' => $createdBy,
        ]);
    }

    public function currentFiscalYear(CostCenter $cc): int
    {
        $now = now();
        $start = $cc->tenant->fiscal_year_start ?? 4;
        return $now->month >= $start ? $now->year : $now->year - 1;
    }
}
