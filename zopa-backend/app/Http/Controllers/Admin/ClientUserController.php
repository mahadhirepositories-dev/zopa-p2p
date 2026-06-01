<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserTenantRole;
use App\Services\UserProvisioningService;
use Illuminate\Http\Request;

class ClientUserController extends Controller
{
    /**
     * Get all users assigned to this tenant (ZOPA staff + Client users).
     */
    public function index($tenantId)
    {
        $tenant = Tenant::findOrFail($tenantId);

        $users = UserTenantRole::with('user', 'assignedBy')
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->get();

        return response()->json($users);
    }

    /**
     * Create a new client-native user and assign them to this tenant.
     */
    public function store(Request $request, $tenantId, UserProvisioningService $provisioner)
    {
        $tenant = Tenant::findOrFail($tenantId);

        // NOTE: email is intentionally NOT `unique:users,email` — the provisioner
        // reactivates a previously-removed user or attaches an existing account,
        // rather than failing when the users row still exists (see service docs).
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'password' => 'required|string|min:8',
            'role' => 'required|string|starts_with:client_',
        ]);

        $userTenantRole = $provisioner->provisionClientUser($tenant, $validated, $request->user()->id);

        return response()->json($userTenantRole->load('user'), 201);
    }

    /**
     * Assign an existing ZOPA staff member to this tenant.
     */
    public function assignStaff(Request $request, $tenantId)
    {
        $tenant = Tenant::findOrFail($tenantId);

        // Internal ZOPA tenants allow L3; external client tenants do not
        $allowedRoles = $tenant->is_internal
            ? 'zopa_buyer,zopa_approver_l1,zopa_approver_l2,zopa_approver_l3'
            : 'zopa_buyer,zopa_approver_l1,zopa_approver_l2';

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'role'    => 'required|string|in:' . $allowedRoles,
        ]);

        $user = User::findOrFail($validated['user_id']);

        if (!$user->is_zopa_staff) {
            return response()->json(['message' => 'Only ZOPA staff can be assigned using this endpoint.'], 422);
        }

        // Check if role is already assigned
        $exists = UserTenantRole::where('user_id', $user->id)
            ->where('tenant_id', $tenant->id)
            ->where('role', $validated['role'])
            ->where('is_active', true)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'User is already assigned this role for the tenant.'], 422);
        }

        $userTenantRole = UserTenantRole::create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'role' => $validated['role'],
            'assigned_by' => $request->user()->id,
            'is_active' => true,
        ]);

        return response()->json($userTenantRole->load('user'), 201);
    }

    /**
     * Update a user's role for this tenant.
     */
    public function updateRole(Request $request, $tenantId, $userId)
    {
        $tenant = Tenant::findOrFail($tenantId);

        $validated = $request->validate([
            'role'               => 'required|string',
            'user_tenant_role_id' => 'nullable|integer',
        ]);


        // Note: The UI might use the UserTenantRole ID, but the spec says /users/{user_id}/role.
        // If a user can have multiple roles in the same tenant (e.g. buyer + L2), we might need to 
        // update a specific assignment or pass the old role. Assuming they only have one role,
        // or updating the first active one. Let's update the specific assignment by passing the role ID instead?
        // Let's just find the first active assignment for simplicity if not provided.
        // A better approach is to pass the UserTenantRole id in the URL, but following the spec:
        
        $roleRecordId = $request->input('user_tenant_role_id');
        
        $query = UserTenantRole::where('tenant_id', $tenant->id)
            ->where('user_id', $userId)
            ->where('is_active', true);
            
        if ($roleRecordId) {
            $query->where('id', $roleRecordId);
        }
        
        $userTenantRole = $query->firstOrFail();

        // Governance: ZOPA staff cannot be L3 on an external client tenant
        $user = User::findOrFail($userId);
        if ($user->is_zopa_staff && $validated['role'] === 'zopa_approver_l3' && !$tenant->is_internal) {
            return response()->json([
                'message' => 'ZOPA staff cannot be assigned as L3 (final) approver for a client. L3 must always be a client-side user.',
            ], 422);
        }

        $userTenantRole->update([
            'role' => $validated['role']
        ]);

        return response()->json($userTenantRole->load('user'));
    }

    /**
     * Remove (soft-delete) a user's assignment to this tenant.
     */
    public function destroy(Request $request, $tenantId, $userId)
    {
        $tenant = Tenant::findOrFail($tenantId);

        $roleRecordId = $request->input('user_tenant_role_id');
        
        $query = UserTenantRole::where('tenant_id', $tenant->id)
            ->where('user_id', $userId);
            
        if ($roleRecordId) {
            $query->where('id', $roleRecordId);
        }
        
        $userTenantRoles = $query->get();
        
        foreach ($userTenantRoles as $role) {
            $role->update(['is_active' => false]);
        }

        return response()->json(['message' => 'User assignment removed successfully.']);
    }
}
