<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrStatusUpdate extends Model
{
    protected $fillable = [
        'tenant_id',
        'pr_id',
        'sent_by',
        'message',
        'cc_emails',
        'attachments',
    ];

    protected $casts = [
        'cc_emails'   => 'array',
        'attachments' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function purchaseRequisition(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'pr_id');
    }

    public function sentBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
