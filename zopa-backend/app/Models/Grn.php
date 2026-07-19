<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Grn extends Model
{
    protected $fillable = [
        'tenant_id', 'po_id', 'grn_number', 'received_date',
        'received_by', 'status', 'remarks',
        'dc_number', 'dc_date', 'invoice_number', 'invoice_date',
    ];

    public function attachments(): HasMany
    {
        return $this->hasMany(GrnAttachment::class);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(GrnItem::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'entity_id')
            ->where('entity_type', 'GRN')
            ->orderByDesc('created_at');
    }
}
