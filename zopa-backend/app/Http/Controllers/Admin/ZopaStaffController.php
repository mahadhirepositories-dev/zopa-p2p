<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserTenantRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ZopaStaffController extends Controller
{
    private function zopaTenant(): Tenant
    {
        return Tenant::where('is_internal', true)->firstOrFail();
    }

    /**
     * List all active ZOPA staff, optionally excluding those already in a tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $zopaTenant = $this->zopaTenant();

        $query = User::where('is_zopa_staff', true)
            ->where('is_active', true)
            ->with(['tenantRoles' => function ($q) use ($zopaTenant) {
                $q->where('tenant_id', $zopaTenant->id)
                  ->where('is_active', true);
            }]);

        $excludeTenantId = $request->query('not_in_tenant_id');
        if ($excludeTenantId) {
            $query->whereDoesntHave('tenantRoles', function ($q) use ($excludeTenantId) {
                $q->where('tenant_id', $excludeTenantId)
                  ->where('is_active', true);
            });
        }

        return response()->json($query->get()->map(fn ($user) => [
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'is_active' => $user->is_active,
            'zopa_role' => $user->tenantRoles->first()?->role,
        ]));
    }

    /**
     * Create a new ZOPA staff member and enrol them in the ZOPA internal tenant.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role'     => 'required|string|in:zopa_super_admin,zopa_buyer,zopa_approver_l1,zopa_approver_l2,zopa_approver_l3',
        ]);

        $zopaTenant = $this->zopaTenant();

        $user = DB::transaction(function () use ($validated, $zopaTenant, $request) {
            $user = User::create([
                'name'          => $validated['name'],
                'email'         => $validated['email'],
                'password'      => Hash::make($validated['password']),
                'is_zopa_staff' => true,
                'is_active'     => true,
            ]);

            UserTenantRole::create([
                'user_id'     => $user->id,
                'tenant_id'   => $zopaTenant->id,
                'role'        => $validated['role'],
                'assigned_by' => $request->user()->id,
                'is_active'   => true,
            ]);

            return $user;
        });

        return response()->json([
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'is_active' => true,
            'zopa_role' => $validated['role'],
        ], 201);
    }

    /**
     * Deactivate a ZOPA staff member and remove all their tenant assignments.
     */
    public function destroy(User $user): JsonResponse
    {
        abort_if(!$user->is_zopa_staff, 404);

        DB::transaction(function () use ($user) {
            $user->update(['is_active' => false]);
            UserTenantRole::where('user_id', $user->id)->update(['is_active' => false]);
        });

        return response()->json(null, 204);
    }
}
