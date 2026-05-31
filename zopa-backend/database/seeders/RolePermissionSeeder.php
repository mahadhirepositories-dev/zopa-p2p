<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the role_permissions table with defaults that EXACTLY mirror the
 * current coarse-grained behaviour (canTransact / isAdmin) so that nothing
 * changes functionally on a fresh install or a migrate:fresh --seed run.
 *
 * Legend: V=view  C=create  E=edit  D=delete
 *
 * Uses insertOrIgnore so it is safe to call multiple times without creating
 * duplicate rows — existing customisations are preserved.
 */
class RolePermissionSeeder extends Seeder
{
    private const MODULES = [
        'purchase_requisitions',
        'purchase_orders',
        'grns',
        'invoices',
        'vendors',
        'products',
        'cost_centers',
        'org_masters',
        'approvals',
        'reports',
        'org_staff',
    ];

    public function run(): void
    {
        $now  = now()->toDateTimeString();
        $rows = [];

        // Helper: append a row
        $p = function (string $role, string $module, bool $v, bool $c, bool $e, bool $d) use ($now, &$rows): void {
            $rows[] = [
                'role'       => $role,
                'module'     => $module,
                'can_view'   => $v,
                'can_create' => $c,
                'can_edit'   => $e,
                'can_delete' => $d,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        };

        // ── zopa_super_admin: unrestricted ──────────────────────────────
        foreach (self::MODULES as $m) {
            $p('zopa_super_admin', $m, true, true, true, true);
        }

        // ── zopa_buyer: transact on procurement docs, view-only on masters
        $p('zopa_buyer', 'purchase_requisitions', true,  true,  true,  false);
        $p('zopa_buyer', 'purchase_orders',       true,  true,  true,  false);
        $p('zopa_buyer', 'grns',                  true,  true,  true,  false);
        $p('zopa_buyer', 'invoices',              true,  true,  true,  false);
        $p('zopa_buyer', 'vendors',               true,  true,  true,  false);
        $p('zopa_buyer', 'products',              true,  false, false, false);
        $p('zopa_buyer', 'cost_centers',          true,  false, false, false);
        $p('zopa_buyer', 'org_masters',           true,  false, false, false);
        $p('zopa_buyer', 'approvals',             true,  true,  true,  false);
        $p('zopa_buyer', 'reports',               true,  false, false, false);
        $p('zopa_buyer', 'org_staff',             true,  false, false, false);

        // ── ZOPA approvers (L1/L2/L3): view docs + act on approvals only
        foreach (['zopa_approver_l1', 'zopa_approver_l2', 'zopa_approver_l3'] as $role) {
            $p($role, 'purchase_requisitions', true,  false, false, false);
            $p($role, 'purchase_orders',       true,  false, false, false);
            $p($role, 'grns',                  true,  false, false, false);
            $p($role, 'invoices',              true,  false, false, false);
            $p($role, 'vendors',               true,  false, false, false);
            $p($role, 'products',              true,  false, false, false);
            $p($role, 'cost_centers',          true,  false, false, false);
            $p($role, 'org_masters',           true,  false, false, false);
            $p($role, 'approvals',             true,  true,  true,  false);
            $p($role, 'reports',               true,  false, false, false);
            $p($role, 'org_staff',             false, false, false, false);
        }

        // ── client_admin: full access within their tenant ───────────────
        foreach (self::MODULES as $m) {
            $p('client_admin', $m, true, true, true, true);
        }

        // ── client_buyer: transact on procurement docs, view-only on masters
        $p('client_buyer', 'purchase_requisitions', true,  true,  true,  false);
        $p('client_buyer', 'purchase_orders',       true,  true,  true,  false);
        $p('client_buyer', 'grns',                  true,  true,  true,  false);
        $p('client_buyer', 'invoices',              true,  true,  true,  false);
        $p('client_buyer', 'vendors',               true,  false, false, false);
        $p('client_buyer', 'products',              true,  false, false, false);
        $p('client_buyer', 'cost_centers',          true,  false, false, false);
        $p('client_buyer', 'org_masters',           true,  false, false, false);
        $p('client_buyer', 'approvals',             true,  false, false, false);
        $p('client_buyer', 'reports',               true,  false, false, false);
        $p('client_buyer', 'org_staff',             false, false, false, false);

        // ── Client approvers (L1/L2/L3): view docs + act on approvals only
        foreach (['client_approver_l1', 'client_approver_l2', 'client_approver_l3'] as $role) {
            $p($role, 'purchase_requisitions', true,  false, false, false);
            $p($role, 'purchase_orders',       true,  false, false, false);
            $p($role, 'grns',                  true,  false, false, false);
            $p($role, 'invoices',              true,  false, false, false);
            $p($role, 'vendors',               true,  false, false, false);
            $p($role, 'products',              true,  false, false, false);
            $p($role, 'cost_centers',          true,  false, false, false);
            $p($role, 'org_masters',           true,  false, false, false);
            $p($role, 'approvals',             true,  true,  true,  false);
            $p($role, 'reports',               true,  false, false, false);
            $p($role, 'org_staff',             false, false, false, false);
        }

        // insertOrIgnore: safe to run multiple times; respects the unique(role, module) constraint
        DB::table('role_permissions')->insertOrIgnore($rows);

        $this->command->info('  ✓ Role permissions seeded (' . count($rows) . ' rows).');
    }
}
