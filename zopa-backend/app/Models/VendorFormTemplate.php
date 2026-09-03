<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VendorFormTemplate extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'vendor_type',
        'description',
        'schema_definition',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'schema_definition' => 'array',
        'is_active'         => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function invites(): HasMany
    {
        return $this->hasMany(VendorOnboardingInvite::class, 'form_template_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(VendorOnboardingResponse::class, 'form_template_id');
    }

    /**
     * Duplicate this template into a new template.
     */
    public function duplicate(?string $newName = null, ?int $userId = null): self
    {
        $clone = $this->replicate();
        $clone->name = $newName ?? ('Copy of ' . $this->name);
        $clone->created_by = $userId ?? auth()->id();
        $clone->created_at = now();
        $clone->updated_at = now();
        $clone->save();

        return $clone;
    }
}
