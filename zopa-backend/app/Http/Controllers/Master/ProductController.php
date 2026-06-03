<?php

namespace App\Http\Controllers\Master;

use App\Exports\ProductTemplateExport;
use App\Http\Controllers\Controller;
use App\Imports\ProductsImport;
use App\Models\Product;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProductController extends Controller
{
    use AuthorizesRoles;

    public function index(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            Product::where('tenant_id', $tenant->id)->with('category', 'subcategory')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireMasterRole();
        $this->requirePermission('products', 'create');

        $request->validate([
            'name'           => 'required|string|max:255',
            'unit'           => 'required|string|max:30',
            'net_rate'       => 'required|numeric|min:0',
            'gst_rate'       => 'required|numeric|min:0|max:100',
            'description'    => 'nullable|string',
            'category_id'    => 'nullable|integer|exists:categories,id',
            'subcategory_id' => 'nullable|integer|exists:categories,id',
        ]);

        $tenant = app('currentTenant');
        $product = Product::create([
            ...$request->only('code', 'name', 'description', 'category_id', 'subcategory_id', 'unit', 'net_rate', 'gst_rate', 'hsn_code', 'warranty_months'),
            'tenant_id' => $tenant->id,
        ]);

        return response()->json($product, 201);
    }

    public function show(Product $product): JsonResponse
    {
        $this->authorizeProduct($product);
        return response()->json($product->load('category', 'subcategory'));
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->requireMasterRole();
        $this->requirePermission('products', 'edit');
        $this->authorizeProduct($product);
        $product->update($request->except('tenant_id'));
        return response()->json($product);
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->requireMasterRole();
        $this->requirePermission('products', 'delete');
        $this->authorizeProduct($product);
        $product->update(['is_active' => false]);
        return response()->json(null, 204);
    }

    /** Download the Excel bulk-import template (with a Categories reference sheet). */
    public function template(): BinaryFileResponse
    {
        $this->requirePermission('products', 'view');
        return Excel::download(
            new ProductTemplateExport(app('currentTenant')->id),
            'product-import-template.xlsx'
        );
    }

    /** Bulk-import products from a filled-in template. */
    public function import(Request $request): JsonResponse
    {
        $this->requireMasterRole();
        $this->requirePermission('products', 'create');
        $request->validate(['file' => 'required|file|mimes:xlsx,xls,csv|max:5120']);

        $import = new ProductsImport(app('currentTenant')->id);
        Excel::import($import, $request->file('file'));

        return response()->json([
            'created' => $import->created,
            'skipped' => count($import->errors),
            'errors'  => $import->errors,
            'message' => "Imported {$import->created} product(s)."
                . (count($import->errors) ? ' ' . count($import->errors) . ' row(s) skipped — see details.' : ''),
        ]);
    }

    private function authorizeProduct(Product $product): void
    {
        abort_if($product->tenant_id !== app('currentTenant')->id, 403);
    }
}
