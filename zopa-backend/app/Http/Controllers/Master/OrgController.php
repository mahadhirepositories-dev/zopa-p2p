<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Location;
use App\Models\Project;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrgController extends Controller
{
    use AuthorizesRoles;

    // --- Departments ---

    public function departments(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            Department::with('head:id,name,email')->where('tenant_id', $tenant->id)->where('is_active', true)->get()
        );
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        $this->requirePermission('org_masters', 'create');

        $request->validate([
            'name' => 'required|string|max:255',
            'head_user_id' => 'nullable|integer|exists:users,id',
        ]);
        $dept = Department::create([
            'tenant_id' => app('currentTenant')->id,
            'name' => $request->name,
            'head_user_id' => $request->head_user_id,
            'is_active' => true,
        ]);
        return response()->json($dept->load('head:id,name,email'), 201);
    }

    public function updateDepartment(Request $request, Department $department): JsonResponse
    {
        $this->requirePermission('org_masters', 'edit');
        abort_if($department->tenant_id !== app('currentTenant')->id, 403);
        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'head_user_id' => 'nullable|integer|exists:users,id',
        ]);
        $department->update($request->only('name', 'is_active', 'head_user_id'));
        return response()->json($department->load('head:id,name,email'));
    }

    public function destroyDepartment(Department $department): JsonResponse
    {
        $this->requirePermission('org_masters', 'delete');
        abort_if($department->tenant_id !== app('currentTenant')->id, 403);
        $department->update(['is_active' => false]);
        return response()->json(null, 204);
    }

    // --- Projects ---

    public function projects(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            Project::where('tenant_id', $tenant->id)->where('is_active', true)->get()
        );
    }

    public function storeProject(Request $request): JsonResponse
    {
        $this->requirePermission('org_masters', 'create');

        $request->validate(['name' => 'required|string|max:255']);
        $proj = Project::create([
            'tenant_id' => app('currentTenant')->id,
            'name' => $request->name,
            'is_active' => true,
        ]);
        return response()->json($proj, 201);
    }

    public function updateProject(Request $request, Project $project): JsonResponse
    {
        $this->requirePermission('org_masters', 'edit');
        abort_if($project->tenant_id !== app('currentTenant')->id, 403);
        $project->update($request->only('name', 'is_active'));
        return response()->json($project);
    }

    public function destroyProject(Project $project): JsonResponse
    {
        $this->requirePermission('org_masters', 'delete');
        abort_if($project->tenant_id !== app('currentTenant')->id, 403);
        $project->update(['is_active' => false]);
        return response()->json(null, 204);
    }

    // --- Locations ---

    public function locations(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            Location::where('tenant_id', $tenant->id)->where('is_active', true)->get()
        );
    }

    public function storeLocation(Request $request): JsonResponse
    {
        $this->requirePermission('org_masters', 'create');

        $request->validate([
            'name'       => 'required|string|max:255',
            'address'    => 'nullable|string|max:500',
            'city'       => 'nullable|string|max:100',
            'state'      => 'nullable|string|max:100',
            'state_code' => 'nullable|string|max:2',
            'pincode'    => 'nullable|string|max:12',
            'country'    => 'nullable|string|max:100',
        ]);
        $loc = Location::create([
            'tenant_id' => app('currentTenant')->id,
            ...$request->only('name', 'address', 'city', 'state', 'state_code', 'pincode', 'country', 'gstin'),
            'country'   => $request->input('country') ?: 'India',
            'is_active' => true,
        ]);
        return response()->json($loc, 201);
    }

    public function updateLocation(Request $request, Location $location): JsonResponse
    {
        $this->requirePermission('org_masters', 'edit');
        abort_if($location->tenant_id !== app('currentTenant')->id, 403);
        $location->update($request->only('name', 'address', 'city', 'state', 'state_code', 'pincode', 'country', 'gstin', 'is_active'));
        return response()->json($location);
    }

    public function destroyLocation(Location $location): JsonResponse
    {
        $this->requirePermission('org_masters', 'delete');
        abort_if($location->tenant_id !== app('currentTenant')->id, 403);
        $location->update(['is_active' => false]);
        return response()->json(null, 204);
    }
}
