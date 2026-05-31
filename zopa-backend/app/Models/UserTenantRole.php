<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTenantRole extends Model
{
    protected $fillable = [
        'user_id', 'tenant_id', 'role', 'assigned_by', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function isClientRole(): bool
    {
        return str_starts_with($this->role, 'client_');
    }

    public function isZopaRole(): bool
    {
        return str_starts_with($this->role, 'zopa_');
    }
}
