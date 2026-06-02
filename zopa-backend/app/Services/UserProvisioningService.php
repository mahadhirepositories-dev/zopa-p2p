<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\User;
use App\Models\UserTenantRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Provisions a client user for a tenant, handling the cases a naive
 * "create a new row" flow gets wrong:
 *
 *   • Re-adding someone who was previously removed (their user_tenant_role was
 *     only soft-deactivated, so the users row + email still exist) — REACTIVATE
 *     the assignment instead of failing on the unique-email rule.
 *   • Adding an account that already exists (e.g. a member of another org) —
 *     ATTACH a role for this tenant (multi-org membership is by design).
 *   • Otherwise create a brand-new user.
 *
 * An existing account's PASSWORD is never changed here — that would let one
 * org's admin alter the credentials of a user who may belong to other orgs.
 * Use the password-reset flow for that.
 */
class UserProvisioningService
{
    /**
     * @param  array{name:string,email:string,password?:string,role:string}  $data
     */
    public function provisionClientUser(Tenant $tenant, array $data, int $assignedBy): UserTenantRole
    {
        return DB::transaction(function () use ($tenant, $data, $assignedBy) {
            $existing = User::where('email', $data['email'])->first();

            // ── Brand-new account ────────────────────────────────────────
            if (!$existing) {
                $user = User::create([
                    'name'          => $data['name'],
                    'email'         => $data['email'],
                    'password'      => Hash::make($data['password'] ?? str()->random(16)),
                    'is_zopa_staff' => false,
                    'is_active'     => true,
                ]);

                return $this->assignRole($user->id, $tenant->id, $data['role'], $assignedBy);
            }

            // ── Existing account ─────────────────────────────────────────
            if ($existing->is_zopa_staff) {
                throw ValidationException::withMessages([
                    'email' => 'This email belongs to a ZOPA staff member. Use "Assign Staff" to add them to a client organisation.',
                ]);
            }

            $utr = UserTenantRole::where('user_id', $existing->id)
                ->where('tenant_id', $tenant->id)
                ->first();

            if ($utr && $utr->is_active) {
                throw ValidationException::withMessages([
                    'email' => 'This user is already a member of this organisation.',
                ]);
            }

            if ($utr) {
                // Reactivate a previously-removed assignment for this tenant.
                if (!empty($data['name']) && $data['name'] !== $existing->name) {
                    $existing->update(['name' => $data['name']]);
                }
                $utr->update([
                    'role'        => $data['role'],
                    'assigned_by' => $assignedBy,
                    'is_active'   => true,
                ]);

                return $utr;
            }

            // Existing account from another org → attach to this tenant.
            return $this->assignRole($existing->id, $tenant->id, $data['role'], $assignedBy);
        });
    }

    /**
     * Provision a ZOPA staff member in the internal ZOPA tenant. Unlike client
     * users, removing staff deactivates the USER row (is_active = false), so
     * re-adding must reactivate the account as well as its role.
     *
     * @param  array{name:string,email:string,password?:string,role:string}  $data
     */
    public function provisionZopaStaff(Tenant $zopaTenant, array $data, int $assignedBy): User
    {
        return DB::transaction(function () use ($zopaTenant, $data, $assignedBy) {
            $existing = User::where('email', $data['email'])->first();

            if (!$existing) {
                $user = User::create([
                    'name'          => $data['name'],
                    'email'         => $data['email'],
                    'password'      => Hash::make($data['password'] ?? str()->random(16)),
                    'is_zopa_staff' => true,
                    'is_active'     => true,
                ]);
                $this->assignRole($user->id, $zopaTenant->id, $data['role'], $assignedBy);

                return $user;
            }

            if (!$existing->is_zopa_staff) {
                throw ValidationException::withMessages([
                    'email' => 'This email belongs to a client user and cannot be added as ZOPA staff.',
                ]);
            }

            $utr = UserTenantRole::where('user_id', $existing->id)
                ->where('tenant_id', $zopaTenant->id)
                ->first();

            if ($existing->is_active && $utr && $utr->is_active) {
                throw ValidationException::withMessages([
                    'email' => 'This ZOPA staff member already exists and is active.',
                ]);
            }

            // Reactivate the staff account (password left unchanged).
            $attrs = ['is_active' => true];
            if (!empty($data['name'])) {
                $attrs['name'] = $data['name'];
            }
            $existing->update($attrs);

            if ($utr) {
                $utr->update(['role' => $data['role'], 'assigned_by' => $assignedBy, 'is_active' => true]);
            } else {
                $this->assignRole($existing->id, $zopaTenant->id, $data['role'], $assignedBy);
            }

            return $existing;
        });
    }

    private function assignRole(int $userId, int $tenantId, string $role, int $assignedBy): UserTenantRole
    {
        return UserTenantRole::create([
            'user_id'     => $userId,
            'tenant_id'   => $tenantId,
            'role'        => $role,
            'assigned_by' => $assignedBy,
            'is_active'   => true,
        ]);
    }
}
