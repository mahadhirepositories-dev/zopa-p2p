<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrItem extends Model
{
    protected $fillable = [
        'pr_id', 'sno', 'product_id', 'description', 'category_id',
        'qty', 'converted_qty', 'unit', 'estimated_price', 'remarks',
    ];

    protected $casts = [
        'qty' => 'decimal:3',
        'converted_qty' => 'decimal:3',
        'estimated_price' => 'decimal:2',
    ];

    public function pr(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequisition::class, 'pr_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
