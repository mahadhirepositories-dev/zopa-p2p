<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorAddress extends Model
{
    protected $fillable = [
        'vendor_id', 'label', 'address', 'pincode', 'city', 'state', 'state_code',
        'country', 'gstin', 'contact_name', 'contact_phone', 'is_default',
    ];

    protected $casts = ['is_default' => 'boolean'];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }
}
