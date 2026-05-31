<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    use AuthorizesRoles;

    public function index(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            Category::where('tenant_id', $tenant->id)
                ->with('children.children')
                ->whereNull('parent_id')
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireAdminRole();
        $this->requirePermission('products', 'create');

        $request->validate(['name' => 'required|string|max:255']);
        $tenant = app('currentTenant');
        $category = Category::create([
            ...$request->only('name', 'parent_id'),
            'tenant_id' => $tenant->id,
        ]);
        return response()->json($category, 201);
    }

    public function show(Category $category): JsonResponse
    {
        abort_if($category->tenant_id !== app('currentTenant')->id, 403);
        return response()->json($category->load('children'));
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $this->requireAdminRole();
        $this->requirePermission('products', 'edit');
        abort_if($category->tenant_id !== app('currentTenant')->id, 403);
        $category->update($request->only('name', 'parent_id'));
        return response()->json($category);
    }

    public function destroy(Category $category): JsonResponse
    {
        $this->requireAdminRole();
        $this->requirePermission('products', 'delete');
        abort_if($category->tenant_id !== app('currentTenant')->id, 403);
        $category->delete();
        return response()->json(null, 204);
    }
}
