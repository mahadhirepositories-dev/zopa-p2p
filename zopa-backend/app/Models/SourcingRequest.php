<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SourcingRequest extends Model
{
    protected $fillable = [
        'sourcing_number',
        'source_type',
        'pr_id',
        'pr_item_id',
        'pr_ref',
        'rfq_ref',
        'item_name',
        'product_id',
        'specification',
        'category_id',
        'category_name',
        'qty',
        'unit',
        'target_price',
        'tenant_id',
        'client_name',
        'location_id',
        'delivery_location',
        'status',
        'created_by',
        'closed_at',
        'closed_by',
        'closure_notes',
    ];

    protected $casts = [
        'qty'          => 'decimal:3',
        'target_price' => 'decimal:2',
        'closed_at'    => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (SourcingRequest $model) {
            if (empty($model->sourcing_number)) {
                $year = date('Y');
                $maxId = static::max('id') ?? 0;
                $seq = str_pad((string)($maxId + 1), 4, '0', STR_PAD_LEFT);
                $model->sourcing_number = "SRC-{$year}-{$seq}";
            }
        });
    }

    public function pr(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'pr_id');
    }

    public function prItem(): BelongsTo
    {
        return $this->belongsTo(PrItem::class, 'pr_item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function vendorContacts(): HasMany
    {
        return $this->hasMany(SourcingVendorContact::class, 'sourcing_request_id')->orderBy('created_at', 'desc');
    }

    public function remarks(): HasMany
    {
        return $this->hasMany(SourcingRemark::class, 'sourcing_request_id')->orderBy('created_at', 'desc');
    }
}
