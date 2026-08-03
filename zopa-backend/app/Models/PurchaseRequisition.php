<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseRequisition extends Model
{
    protected $fillable = [
        'tenant_id', 'pr_ref', 'pr_number', 'cost_center_id', 'project_id', 'location_id',
        'title', 'description', 'estimated_amount', 'priority',
        'required_by_date', 'required_by_person',
        'requested_by', 'buyer_id', 'status', 'submitted_at', 'converted_at',
        'short_close_reason', 'short_closed_at', 'short_closed_by',
        'needs_clarification', 'clarification_requested_at', 'clarification_requested_by',
        'clarification_provided_at', 'clarification_provided_by', 'total_clarification_duration_seconds',
    ];

    protected $casts = [
        'estimated_amount'                  => 'decimal:2',
        'needs_clarification'               => 'boolean',
        'submitted_at'                      => 'datetime',
        'converted_at'                      => 'datetime',
        'short_closed_at'                   => 'datetime',
        'clarification_requested_at'        => 'datetime',
        'clarification_provided_at'         => 'datetime',
        'required_by_date'                  => 'date',
        'total_clarification_duration_seconds' => 'integer',
    ];


    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function shortClosedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'short_closed_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PrItem::class, 'pr_id')->orderBy('sno');
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class, 'pr_id');
    }

    public function linkedPurchaseOrders(): BelongsToMany
    {
        return $this->belongsToMany(PurchaseOrder::class, 'po_prs', 'pr_id', 'po_id')
            ->withTimestamps();
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'entity_id')
            ->where('entity_type', 'PR')
            ->orderByDesc('created_at');
    }

    public function clarifications(): HasMany
    {
        return $this->hasMany(PrClarification::class, 'pr_id')->orderByDesc('created_at');
    }
}

