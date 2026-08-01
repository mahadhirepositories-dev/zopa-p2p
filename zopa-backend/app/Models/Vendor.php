<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'global_vendor_code', 'entity_code',
        'vendor_type', 'entity_type',
        'pan', 'pan_not_available', 'gst_status', 'gstin',
        'email', 'phone', 'currency',
        'category_id', 'subcategory_id', 'is_active',
        'account_no', 'ifsc', 'micr', 'bank_name', 'branch_name',
        'special_status', 'special_status_reg_no',
        'special_status_start_date', 'special_status_end_date',
    ];

    protected $casts = [
        'is_active'                 => 'boolean',
        'pan_not_available'         => 'boolean',
        'special_status_start_date' => 'date',
        'special_status_end_date'   => 'date',
    ];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function category(): BelongsTo { return $this->belongsTo(Category::class, 'category_id'); }
    public function subcategory(): BelongsTo { return $this->belongsTo(Category::class, 'subcategory_id'); }

    public function addresses(): HasMany { return $this->hasMany(VendorAddress::class); }
    public function defaultAddress(): HasMany { return $this->hasMany(VendorAddress::class)->where('is_default', true); }

    public function vendorCategories(): HasMany { return $this->hasMany(VendorCategory::class); }
    public function documents(): HasMany { return $this->hasMany(VendorDocument::class); }
    public function purchaseOrders(): HasMany { return $this->hasMany(PurchaseOrder::class, 'vendor_id')->latest(); }
}
