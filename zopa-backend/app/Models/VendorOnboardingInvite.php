<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class VendorOnboardingInvite extends Model
{
    protected $fillable = [
        'tenant_id',
        'form_template_id',
        'token',
        'vendor_name',
        'vendor_email',
        'phone',
        'status',
        'expires_at',
        'submitted_at',
        'invited_by',
    ];

    protected $casts = [
        'expires_at'   => 'datetime',
        'submitted_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(VendorFormTemplate::class, 'form_template_id');
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function response(): HasOne
    {
        return $this->hasOne(VendorOnboardingResponse::class, 'invite_id');
    }

    public function isExpired(): bool
    {
        return now()->isAfter($this->expires_at);
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted' || !is_null($this->submitted_at);
    }
}
