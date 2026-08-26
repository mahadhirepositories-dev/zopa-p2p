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

        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'head_user_id' => 'nullable|integer|exists:users,id',
            'is_active'    => 'nullable|boolean',
        ]);

        $dept = Department::create([
            'tenant_id'    => app('currentTenant')->id,
            'name'         => $validated['name'],
            'head_user_id' => !empty($validated['head_user_id']) ? $validated['head_user_id'] : null,
            'is_active'    => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);
        return response()->json($dept->load('head:id,name,email'), 201);
    }

    public function updateDepartment(Request $request, Department $department): JsonResponse
    {
        $this->requirePermission('org_masters', 'edit');
        abort_if($department->tenant_id !== app('currentTenant')->id, 403);

        $validated = $request->validate([
            'name'         => 'sometimes|required|string|max:255',
            'head_user_id' => 'nullable|integer|exists:users,id',
            'is_active'    => 'nullable|boolean',
        ]);

        $data = $request->only('name', 'is_active');
        if ($request->has('head_user_id')) {
            $data['head_user_id'] = !empty($request->head_user_id) ? $request->head_user_id : null;
        }

        $department->update($data);
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
        // Auto-deactivate projects that have expired
        Project::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->whereNotNull('end_date')
            ->where('end_date', '<', now()->toDateString())
            ->update(['is_active' => false]);

        return response()->json(
            Project::where('tenant_id', $tenant->id)->where('is_active', true)->get()
        );
    }

    public function storeProject(Request $request): JsonResponse
    {
        $this->requirePermission('org_masters', 'create');

        $validated = $request->validate([
            'name'          => 'required|string|max:255',
            'end_date'      => 'nullable|date',
            'department_id' => 'nullable|integer|exists:departments,id',
            'is_active'     => 'nullable|boolean',
        ]);

        $proj = Project::create([
            'tenant_id'     => app('currentTenant')->id,
            'name'          => $validated['name'],
            'department_id' => !empty($validated['department_id']) ? $validated['department_id'] : null,
            'end_date'      => !empty($validated['end_date']) ? $validated['end_date'] : null,
            'is_active'     => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);
        return response()->json($proj, 201);
    }

    public function updateProject(Request $request, Project $project): JsonResponse
    {
        $this->requirePermission('org_masters', 'edit');
        abort_if($project->tenant_id !== app('currentTenant')->id, 403);

        $validated = $request->validate([
            'name'          => 'sometimes|required|string|max:255',
            'end_date'      => 'nullable|date',
            'department_id' => 'nullable|integer|exists:departments,id',
            'is_active'     => 'nullable|boolean',
        ]);

        $data = $request->only('name', 'is_active');
        if ($request->has('end_date')) {
            $data['end_date'] = !empty($request->end_date) ? $request->end_date : null;
        }
        if ($request->has('department_id')) {
            $data['department_id'] = !empty($request->department_id) ? $request->department_id : null;
        }

        $project->update($data);
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

        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'address'        => 'nullable|string|max:500',
            'city'           => 'nullable|string|max:100',
            'state'          => 'nullable|string|max:100',
            'state_code'     => 'nullable|string|max:10',
            'pincode'        => 'nullable|string|max:20',
            'country'        => 'nullable|string|max:100',
            'gstin'          => 'nullable|string|max:20',
            'receiver_name'  => 'nullable|string|max:255',
            'receiver_phone' => 'nullable|string|max:50',
            'is_active'      => 'nullable|boolean',
        ]);

        $loc = Location::create([
            'tenant_id'      => app('currentTenant')->id,
            'name'           => $validated['name'],
            'address'        => !empty($validated['address']) ? $validated['address'] : null,
            'city'           => !empty($validated['city']) ? $validated['city'] : null,
            'state'          => !empty($validated['state']) ? $validated['state'] : null,
            'state_code'     => !empty($validated['state_code']) ? $validated['state_code'] : null,
            'pincode'        => !empty($validated['pincode']) ? $validated['pincode'] : null,
            'country'        => !empty($validated['country']) ? $validated['country'] : 'India',
            'gstin'          => !empty($validated['gstin']) ? strtoupper(trim($validated['gstin'])) : null,
            'receiver_name'  => !empty($validated['receiver_name']) ? $validated['receiver_name'] : null,
            'receiver_phone' => !empty($validated['receiver_phone']) ? $validated['receiver_phone'] : null,
            'is_active'      => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);
        return response()->json($loc, 201);
    }

    public function updateLocation(Request $request, Location $location): JsonResponse
    {
        $this->requirePermission('org_masters', 'edit');
        abort_if($location->tenant_id !== app('currentTenant')->id, 403);

        $validated = $request->validate([
            'name'           => 'sometimes|required|string|max:255',
            'address'        => 'nullable|string|max:500',
            'city'           => 'nullable|string|max:100',
            'state'          => 'nullable|string|max:100',
            'state_code'     => 'nullable|string|max:10',
            'pincode'        => 'nullable|string|max:20',
            'country'        => 'nullable|string|max:100',
            'gstin'          => 'nullable|string|max:20',
            'receiver_name'  => 'nullable|string|max:255',
            'receiver_phone' => 'nullable|string|max:50',
            'is_active'      => 'nullable|boolean',
        ]);

        $data = $request->only('name', 'address', 'city', 'state', 'state_code', 'pincode', 'country', 'is_active', 'receiver_name', 'receiver_phone');
        if ($request->has('gstin')) {
            $data['gstin'] = !empty($request->gstin) ? strtoupper(trim($request->gstin)) : null;
        }

        $location->update($data);
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
