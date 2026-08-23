<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SourcingVendorContact extends Model
{
    protected $fillable = [
        'sourcing_request_id',
        'vendor_id',
        'vendor_name',
        'contact_person',
        'phone',
        'email',
        'quoted_price',
        'gst_rate',
        'lead_time_days',
        'payment_terms',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'quoted_price'   => 'decimal:2',
        'gst_rate'       => 'decimal:2',
        'lead_time_days' => 'integer',
    ];

    public function sourcingRequest(): BelongsTo
    {
        return $this->belongsTo(SourcingRequest::class, 'sourcing_request_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
