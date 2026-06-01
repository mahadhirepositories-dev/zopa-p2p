<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'name', 'description', 'category_id', 'subcategory_id',
        'unit', 'net_rate', 'gst_rate', 'hsn_code', 'warranty_months', 'is_active',
    ];

    protected $casts = [
        'net_rate' => 'decimal:2',
        'gst_rate' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function subcategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'subcategory_id');
    }
}
