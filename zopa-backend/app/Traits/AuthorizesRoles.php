<?php

namespace App\Traits;

/**
 * Role-based authorization helper for tenant-scoped controllers.
 *
 * Role groups:
 *  TRANSACT  — can create/edit transactional documents (PR, PO, GRN, Invoice)
 *  ADMIN     — can manage master data, settings, and approve/reject financials
 *
 * Usage:
 *   use AuthorizesRoles;
 *   $this->requireTransactRole();   // inside store/update/submit
 *   $this->requireAdminRole();      // inside master-data write actions
 */
trait AuthorizesRoles
{
    /** May create, edit, submit PR / PO / GRN / Invoice */
    protected const TRANSACT_ROLES = [
        'zopa_super_admin',
        'zopa_buyer',
        'client_admin',
        'client_buyer',
    ];

    /** May manage master data, payment release, manual approval overrides */
    protected const ADMIN_ROLES = [
        'zopa_super_admin',
        'client_admin',
    ];

    protected function requireTransactRole(): void
    {
        $this->requireRole(...self::TRANSACT_ROLES);
    }

    protected function requireAdminRole(): void
    {
        $this->requireRole(...self::ADMIN_ROLES);
    }

    protected function requireRole(string ...$roles): void
    {
        $current = app()->bound('currentRole') ? app('currentRole') : null;

        if (!$current || !in_array($current, $roles)) {
            abort(403, 'You do not have permission to perform this action.');
        }
    }

    protected function hasAdminRole(): bool
    {
        $current = app()->bound('currentRole') ? app('currentRole') : null;
        return $current && in_array($current, self::ADMIN_ROLES);
    }

    protected function hasTransactRole(): bool
    {
        $current = app()->bound('currentRole') ? app('currentRole') : null;
        return $current && in_array($current, self::TRANSACT_ROLES);
    }

    /**
     * Fine-grained, restrict-only enforcement of the Access Control matrix.
     *
     * This is layered AFTER the coarse requireTransactRole()/requireAdminRole()
     * checks — it can only further restrict, never grant. Semantics:
     *
     *   - zopa_super_admin is always allowed.
     *   - If the role has NO configured permission rows (feature not seeded on
     *     a legacy install), this is a no-op so existing behaviour is preserved.
     *   - Otherwise the role must have the requested $action on $module, or 403.
     *
     * @param  string  $module  e.g. 'purchase_orders'
     * @param  string  $action  'view' | 'create' | 'edit' | 'delete'
     */
    protected function requirePermission(string $module, string $action): void
    {
        if (!$this->can($module, $action)) {
            abort(403, 'Your role does not permit this action (' . $action . ' on ' . $module . ').');
        }
    }

    /**
     * Boolean form of requirePermission() — true if the action is allowed.
     */
    protected function can(string $module, string $action): bool
    {
        $role = app()->bound('currentRole') ? app('currentRole') : null;

        if (!$role) {
            return false;
        }
        if ($role === 'zopa_super_admin') {
            return true;
        }

        $service = app(\App\Services\PermissionService::class);

        // Restrict-only: if the matrix isn't configured for this role, defer to
        // the coarse checks that the caller already applied (no-op here).
        if (!$service->roleHasAnyConfig($role)) {
            return true;
        }

        return $service->roleCanDo($role, $module, $action);
    }
}
