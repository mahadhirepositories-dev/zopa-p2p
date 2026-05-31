<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'name', 'email', 'phone', 'password', 'is_zopa_staff', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_zopa_staff' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function tenantRoles(): HasMany
    {
        return $this->hasMany(UserTenantRole::class);
    }

    public function hasRoleInTenant(string $role, int $tenantId): bool
    {
        return $this->tenantRoles()
            ->where('tenant_id', $tenantId)
            ->where('role', $role)
            ->where('is_active', true)
            ->exists();
    }

    public function isSuperAdmin(): bool
    {
        return $this->is_zopa_staff && $this->tenantRoles()
            ->where('role', 'zopa_super_admin')
            ->where('is_active', true)
            ->exists();
    }
}
