<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use AuthorizesRoles;

    public function index(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            Product::where('tenant_id', $tenant->id)->with('category')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireAdminRole();
        $this->requirePermission('products', 'create');

        $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:30',
            'net_rate' => 'required|numeric|min:0',
            'gst_rate' => 'required|numeric|min:0|max:100',
        ]);

        $tenant = app('currentTenant');
        $product = Product::create([
            ...$request->only('code', 'name', 'description', 'category_id', 'unit', 'net_rate', 'gst_rate', 'hsn_code', 'warranty_months'),
            'tenant_id' => $tenant->id,
        ]);

        return response()->json($product, 201);
    }

    public function show(Product $product): JsonResponse
    {
        $this->authorizeProduct($product);
        return response()->json($product->load('category'));
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->requireAdminRole();
        $this->requirePermission('products', 'edit');
        $this->authorizeProduct($product);
        $product->update($request->except('tenant_id'));
        return response()->json($product);
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->requireAdminRole();
        $this->requirePermission('products', 'delete');
        $this->authorizeProduct($product);
        $product->update(['is_active' => false]);
        return response()->json(null, 204);
    }

    private function authorizeProduct(Product $product): void
    {
        abort_if($product->tenant_id !== app('currentTenant')->id, 403);
    }
}
