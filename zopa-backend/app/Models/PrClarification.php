<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrClarification extends Model
{
    protected $fillable = [
        'tenant_id',
        'pr_id',
        'requested_by',
        'request_notes',
        'request_attachments',
        'requested_at',
        'provided_by',
        'response_notes',
        'response_attachments',
        'provided_at',
        'duration_seconds',
        'status',
    ];

    protected $casts = [
        'request_attachments' => 'array',
        'response_attachments' => 'array',
        'requested_at' => 'datetime',
        'provided_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function purchaseRequisition(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'pr_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'provided_by');
    }
}
