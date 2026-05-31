<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetLedger extends Model
{
    protected $table = 'budget_ledger';

    protected $fillable = [
        'cost_center_id', 'fiscal_year', 'reference_type', 'reference_id',
        'freeze_amount', 'consume_amount', 'adjust_amount', 'action', 'narration', 'created_by',
    ];

    protected $casts = [
        'freeze_amount' => 'decimal:2',
        'consume_amount' => 'decimal:2',
        'adjust_amount' => 'decimal:2',
    ];

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
