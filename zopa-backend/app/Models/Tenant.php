<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    protected $fillable = [
        'name', 'code', 'gstin', 'address_json',
        'po_prefix', 'fiscal_year_start',        'is_active', 'is_internal', 'logo_path',
        'po_starting_series', 'pr_prefix', 'pr_starting_series', 'plan',
        'product_prefix', 'product_series',
    ];

    protected $casts = [
        'address_json' => 'array',
        'is_active' => 'boolean',
        'is_internal' => 'boolean',
        'po_starting_series' => 'integer',
        'pr_starting_series' => 'integer',
        'product_series'     => 'integer',
    ];

    public function userTenantRoles(): HasMany
    {
        return $this->hasMany(UserTenantRole::class);
    }

    public function costCenters(): HasMany
    {
        return $this->hasMany(CostCenter::class);
    }

    public function vendors(): HasMany
    {
        return $this->hasMany(Vendor::class);
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }
}
