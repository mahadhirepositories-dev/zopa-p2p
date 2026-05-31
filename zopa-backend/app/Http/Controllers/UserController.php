<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserTenantRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * List all active users assigned to the current tenant.
     */
    public function tenantUsers(): JsonResponse
    {
        $tenant = app('currentTenant');

        $users = UserTenantRole::where('tenant_id', $tenant->id)
            ->with(['user:id,name,email', 'tenant:id,name'])
            ->where('is_active', true)
            ->get()
            ->map(fn ($utr) => [
                'id'          => $utr->user->id,
                'utr_id'      => $utr->id,
                'name'        => $utr->user->name,
                'email'       => $utr->user->email,
                'role'        => $utr->role,
                'tenant_name' => $utr->tenant->name ?? null,
            ]);

        return response()->json($users);
    }

    /**
     * Create a new client-native user and assign them to the current tenant.
     * Only client_admin may call this.
     */
    public function store(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');

        // Ensure caller is a client_admin for this tenant
        $callerRole = UserTenantRole::where('tenant_id', $tenant->id)
            ->where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->value('role');

        if ($callerRole !== 'client_admin') {
            return response()->json(['message' => 'Only a Client Admin can add users.'], 403);
        }

        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role'     => 'required|string|starts_with:client_',
        ]);

        $utr = DB::transaction(function () use ($validated, $tenant, $request) {
            $user = User::create([
                'name'          => $validated['name'],
                'email'         => $validated['email'],
                'password'      => Hash::make($validated['password']),
                'is_zopa_staff' => false,
                'is_active'     => true,
            ]);

            return UserTenantRole::create([
                'user_id'     => $user->id,
                'tenant_id'   => $tenant->id,
                'role'        => $validated['role'],
                'assigned_by' => $request->user()->id,
                'is_active'   => true,
            ]);
        });

        $utr->load('user');

        return response()->json([
            'id'     => $utr->user->id,
            'utr_id' => $utr->id,
            'name'   => $utr->user->name,
            'email'  => $utr->user->email,
            'role'   => $utr->role,
        ], 201);
    }

    /**
     * Deactivate a client user's assignment in the current tenant.
     * Only client_admin may call this; cannot remove ZOPA staff.
     */
    public function destroy(Request $request, int $userId): JsonResponse
    {
        $tenant = app('currentTenant');

        if ($request->user()->id === $userId) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 422);
        }

        $utr = UserTenantRole::where('tenant_id', $tenant->id)
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->firstOrFail();

        if (str_starts_with($utr->role, 'zopa_')) {
            return response()->json(['message' => 'ZOPA staff assignments are managed by the ZOPA admin.'], 422);
        }

        $utr->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
