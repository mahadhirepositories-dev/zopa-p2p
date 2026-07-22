<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\RolePermission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    /**
     * Get all roles.
     */
    public function index(): JsonResponse
    {
        $roles = Role::orderBy('name')->get();
        return response()->json($roles);
    }

    /**
     * Create a new role.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:60', 'unique:org_roles,slug'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(['zopa', 'client'])],
        ]);

        $validated['is_system'] = false; // Custom roles are never system roles

        $role = Role::create($validated);

        return response()->json(['message' => 'Role created successfully.', 'role' => $role]);
    }

    /**
     * Update an existing role.
     */
    public function update(Request $request, string $slug): JsonResponse
    {
        $role = Role::where('slug', $slug)->firstOrFail();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(['zopa', 'client'])],
        ]);

        $role->update($validated);

        return response()->json(['message' => 'Role updated successfully.', 'role' => $role]);
    }

    /**
     * Delete a role.
     */
    public function destroy(string $slug): JsonResponse
    {
        $role = Role::where('slug', $slug)->firstOrFail();

        if ($role->is_system) {
            return response()->json(['message' => 'System roles cannot be deleted.'], 403);
        }

        DB::transaction(function () use ($role) {
            // Delete associated role permissions
            RolePermission::where('role', $role->slug)->delete();
            $role->delete();
        });

        return response()->json(['message' => 'Role deleted successfully.']);
    }
}
