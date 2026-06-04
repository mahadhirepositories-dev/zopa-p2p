<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PoItem extends Model
{
    protected $fillable = [
        'po_id', 'sno', 'pr_item_id', 'product_id', 'description', 'category_id',
        'qty', 'unit', 'net_rate', 'gst_rate', 'gross_rate', 'amount', 'required_by', 'warranty_months',
    ];

    protected $casts = [
        'qty' => 'decimal:3',
        'net_rate' => 'decimal:2',
        'gst_rate' => 'decimal:2',
        'gross_rate' => 'decimal:2',
        'amount' => 'decimal:2',
        'required_by' => 'date',
    ];

    public function po(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function prItem(): BelongsTo
    {
        return $this->belongsTo(PrItem::class);
    }
}
