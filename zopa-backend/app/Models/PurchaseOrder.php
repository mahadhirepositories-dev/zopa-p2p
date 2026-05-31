<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PurchaseOrder extends Model
{
    protected $fillable = [
        'tenant_id', 'pr_id', 'pr_reference', 'po_number', 'po_date',
        'bill_to_location_id', 'ship_to_location_id',
        'vendor_id', 'vendor_address_id', 'cost_center_id',
        'po_valid_till', 'payment_terms_json', 'warranty_months',
        'terms_conditions', 'freight', 'net_total', 'tax_amount',
        'grand_total', 'round_off', 'status',
        'created_by_role', 'created_by',
        'approved_by', 'approved_by_role', 'approved_at', 'released_at',
        'delivered_at', 'invoiced_at', 'payment_released_at',
    ];

    protected $casts = [
        'payment_terms_json' => 'array',
        'po_date' => 'date',
        'po_valid_till' => 'date',
        'approved_at' => 'datetime',
        'released_at' => 'datetime',
        'delivered_at' => 'datetime',
        'invoiced_at' => 'datetime',
        'payment_released_at' => 'datetime',
        'freight' => 'decimal:2',
        'net_total' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'round_off' => 'decimal:2',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function pr(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'pr_id');
    }

    public function prs(): BelongsToMany
    {
        return $this->belongsToMany(PurchaseRequisition::class, 'po_prs', 'po_id', 'pr_id')
            ->withTimestamps();
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function vendorAddress(): BelongsTo
    {
        return $this->belongsTo(VendorAddress::class);
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    public function billToLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'bill_to_location_id');
    }

    public function shipToLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'ship_to_location_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PoItem::class, 'po_id')->orderBy('sno');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(PoAttachment::class, 'po_id');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(Approval::class, 'entity_id')
            ->where('entity_type', 'PO')
            ->orderBy('level');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'po_id');
    }

    public function tatRecord(): HasOne
    {
        return $this->hasOne(TatRecord::class);
    }

    public function grns(): HasMany
    {
        return $this->hasMany(Grn::class, 'po_id');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'entity_id')
            ->where('entity_type', 'PO')
            ->orderByDesc('created_at');
    }
}
