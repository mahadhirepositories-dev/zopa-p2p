<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    protected $fillable = [
        'name', 'code', 'gstin', 'address_json',
        'po_prefix', 'fiscal_year_start', 'is_active', 'is_internal', 'logo_path', 'plan',
    ];

    protected $casts = [
        'address_json' => 'array',
        'is_active'    => 'boolean',
        'is_internal'  => 'boolean',
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
