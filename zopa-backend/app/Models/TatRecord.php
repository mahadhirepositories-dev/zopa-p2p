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
    ];

    protected $casts = [
        'pr_submitted_at' => 'datetime',
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
}
