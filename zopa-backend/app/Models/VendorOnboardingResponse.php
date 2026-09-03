<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VendorOnboardingResponse extends Model
{
    protected $fillable = [
        'invite_id',
        'tenant_id',
        'form_template_id',
        'form_snapshot',
        'form_data',
        'status',
        'admin_notes',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'created_vendor_id',
    ];

    protected $casts = [
        'form_snapshot' => 'array',
        'form_data'     => 'array',
        'approved_at'   => 'datetime',
        'rejected_at'   => 'datetime',
    ];

    public function invite(): BelongsTo
    {
        return $this->belongsTo(VendorOnboardingInvite::class, 'invite_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(VendorFormTemplate::class, 'form_template_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class, 'created_vendor_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(VendorOnboardingAttachment::class, 'response_id');
    }
}
