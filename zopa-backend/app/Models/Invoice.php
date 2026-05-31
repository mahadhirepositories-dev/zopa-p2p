<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    protected $fillable = [
        'tenant_id', 'po_id', 'grn_id', 'invoice_number', 'invoice_date',
        'vendor_invoice_ref', 'invoice_type', 'amount', 'freight',
        'taxable_amount', 'tax_amount', 'notes', 'status', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'amount'          => 'decimal:2',
        'freight'         => 'decimal:2',
        'taxable_amount'  => 'decimal:2',
        'tax_amount'      => 'decimal:2',
        'invoice_date'    => 'date',
        'approved_at'     => 'datetime',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
    }

    public function grn(): BelongsTo
    {
        return $this->belongsTo(Grn::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'entity_id')
            ->where('entity_type', 'INVOICE')
            ->orderByDesc('created_at');
    }
}
