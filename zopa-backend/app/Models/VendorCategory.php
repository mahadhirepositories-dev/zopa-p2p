<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorCategory extends Model
{
    protected $fillable = ['vendor_id', 'category_id', 'subcategory_id'];

    public function vendor(): BelongsTo { return $this->belongsTo(Vendor::class); }
    public function category(): BelongsTo { return $this->belongsTo(Category::class, 'category_id'); }
    public function subcategory(): BelongsTo { return $this->belongsTo(Category::class, 'subcategory_id'); }
}
