<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TatRecord extends Model
{
    protected $fillable = [
        'po_id', 'pr_id',
        'pr_submitted_at', 'po_created_at', 'po_approved_at',
        'po_released_at', 'grn_received_at', 'po_delivered_at', 'invoice_approved_at',
        'clarification_requested_at', 'clarification_provided_at', 'clarification_duration_seconds',
    ];

    protected $casts = [
        'pr_submitted_at' => 'datetime',
        'clarification_requested_at' => 'datetime',
        'clarification_provided_at' => 'datetime',
        'clarification_duration_seconds' => 'integer',
        'po_created_at' => 'datetime',
        'po_approved_at' => 'datetime',
        'po_released_at' => 'datetime',
        'grn_received_at' => 'datetime',
        'po_delivered_at' => 'datetime',
        'invoice_approved_at' => 'datetime',
    ];

    public function po(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function pr(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class);
    }

    /**
     * Days from PR submission to PO creation, minus time waiting on clarification.
     * The PR holds the total because clarifications can land on a different TAT row than the PO's.
     */
    public function netPrTatDays(): float
    {
        $seconds = $this->pr_submitted_at->diffInSeconds($this->po_created_at);

        return max(0, $seconds - ($this->pr?->total_clarification_duration_seconds ?? 0)) / 86400;
    }
}
