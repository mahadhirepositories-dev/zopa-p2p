<?php

namespace App\Services;

use App\Models\RolePermission;
use Illuminate\Support\Facades\Cache;

/**
 * Fine-grained permission checks for use in controllers.
 *
 * The existing AuthorizesRoles trait remains the primary guard for all
 * current controllers. This service is the opt-in hook for new controllers
 * (or gradual migration of existing ones) to honour per-module permissions
 * configured in the Access Control admin screen.
 *
 * Cache strategy: one entry per (role, module) pair, TTL 5 minutes.
 * The RolePermissionsController busts both the per-role keys and the full
 * matrix key whenever a role's permissions are saved.
 */
class PermissionService
{
    /** zopa_super_admin is always allowed to do everything. */
    private const SUPER_ADMIN = 'zopa_super_admin';

    /**
     * Check whether $role may perform $action on $module.
     *
     * @param  string  $role    e.g. 'client_buyer'
     * @param  string  $module  e.g. 'purchase_orders'
     * @param  string  $action  'view' | 'create' | 'edit' | 'delete'
     */
    public function roleCanDo(string $role, string $module, string $action): bool
    {
        if ($role === self::SUPER_ADMIN) {
            return true;
        }

        $cacheKey = "role_perm_{$role}_{$module}";

        // Cache a plain array (not the Eloquent model) to avoid serialization issues.
        $perm = Cache::remember($cacheKey, 300, fn () =>
            RolePermission::where('role', $role)
                ->where('module', $module)
                ->first()
                ?->only(['can_view', 'can_create', 'can_edit', 'can_delete'])
        );

        if (!$perm) {
            return false;
        }

        return match ($action) {
            'view'   => (bool) ($perm['can_view']   ?? false),
            'create' => (bool) ($perm['can_create'] ?? false),
            'edit'   => (bool) ($perm['can_edit']   ?? false),
            'delete' => (bool) ($perm['can_delete'] ?? false),
            default  => false,
        };
    }

    /**
     * Whether the Access Control matrix has been configured for a role at all.
     *
     * Used for restrict-only enforcement: if a role has zero configured rows
     * (e.g. the feature has not been seeded on a legacy install), controllers
     * fall back to their existing coarse-grained role checks instead of
     * denying everything — preventing accidental lock-outs.
     */
    public function roleHasAnyConfig(string $role): bool
    {
        return (bool) Cache::remember(
            "role_perm_has_config_{$role}",
            300,
            fn () => RolePermission::where('role', $role)->exists()
        );
    }

    /**
     * Bust all cached entries for a role after its permissions are updated.
     */
    public function bustCache(string $role, array $modules): void
    {
        foreach ($modules as $module) {
            Cache::forget("role_perm_{$role}_{$module}");
        }
        Cache::forget("role_perm_has_config_{$role}");
        Cache::forget('role_permissions_matrix');
    }

    /**
     * Build the full permissions matrix (all roles × all modules).
     * Used by the admin controller and the public /role-permissions endpoint.
     *
     * @return array<string, array<string, array{can_view:bool, can_create:bool, can_edit:bool, can_delete:bool}>>
     */
    public function buildMatrix(array $roles, array $modules): array
    {
        // Initialise with false defaults
        $matrix = [];
        foreach ($roles as $role) {
            foreach ($modules as $module) {
                $matrix[$role][$module] = [
                    'can_view'   => in_array($module, ['dashboard', 'executive_dashboard'], true),
                    'can_create' => false,
                    'can_edit'   => false,
                    'can_delete' => false,
                ];
            }
        }

        // Overlay DB values
        RolePermission::whereIn('role', $roles)
            ->whereIn('module', $modules)
            ->get()
            ->each(function ($perm) use (&$matrix) {
                if (isset($matrix[$perm->role][$perm->module])) {
                    $matrix[$perm->role][$perm->module] = [
                        'can_view'   => (bool) $perm->can_view,
                        'can_create' => (bool) $perm->can_create,
                        'can_edit'   => (bool) $perm->can_edit,
                        'can_delete' => (bool) $perm->can_delete,
                    ];
                }
            });

        return $matrix;
    }
}
