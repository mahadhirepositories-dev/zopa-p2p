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

    public function export(Request $request)
    {
        $this->requirePermission('products', 'view');
        $tenant = app('currentTenant');
        
        $query = Product::where('tenant_id', $tenant->id)->with('category', 'subcategory');

        $data = $query->latest()->get()->map(fn($p) => [
            'Code' => $p->code,
            'Name' => $p->name,
            'Category' => optional($p->category)->name,
            'Subcategory' => optional($p->subcategory)->name,
            'Unit' => $p->unit,
            'Net Rate' => $p->net_rate,
            'GST Rate' => $p->gst_rate,
            'Status' => $p->is_active ? 'Active' : 'Inactive',
        ]);

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\GenericExport($data, ['Code', 'Name', 'Category', 'Subcategory', 'Unit', 'Net Rate', 'GST Rate', 'Status']),
            'products.xlsx'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('products', 'create');

        $request->validate([
            'name'           => 'required|string|max:255',
            'unit'           => 'required|string|max:30',
            'net_rate'       => 'required|numeric|min:0',
            'gst_rate'       => 'required|numeric|min:0|max:100',
            'description'    => 'nullable|string',
            'category_id'    => 'nullable|integer|exists:categories,id',
            'subcategory_id' => 'nullable|integer|exists:categories,id',
            'mrp'            => 'nullable|numeric|min:0',
            'sale_price'     => 'nullable|numeric|min:0',
            'is_active'      => 'nullable|boolean',
        ]);

        $tenant = app('currentTenant');

        $code = trim((string) ($request->code ?? ''));
        if ($code !== '') {
            $exists = Product::where('tenant_id', $tenant->id)->where('code', $code)->exists();
            if ($exists) {
                return response()->json([
                    'message' => 'The given data was invalid.',
                    'errors'  => ['code' => ["Product Code '{$code}' already exists for this organization."]]
                ], 422);
            }
        } else {
            // Use tenant's product_prefix if set, otherwise fallback to 'PRD-'
            $prefix = !empty($tenant->product_prefix) ? $tenant->product_prefix : 'PRD-';
            $series = $tenant->product_series ?? 1;
            do {
                $code = $prefix . str_pad($series++, 4, '0', STR_PAD_LEFT);
            } while (Product::where('tenant_id', $tenant->id)->where('code', $code)->exists());
            // Persist the incremented series back to tenant
            $tenant->increment('product_series', $series - ($tenant->product_series ?? 1));
        }

        $data = $request->only('name', 'description', 'unit', 'net_rate', 'gst_rate', 'hsn_code', 'warranty_months', 'mrp', 'sale_price');
        $data['category_id']    = $request->filled('category_id') ? (int) $request->category_id : null;
        $data['subcategory_id'] = $request->filled('subcategory_id') ? (int) $request->subcategory_id : null;
        $data['code']           = $code;
        $data['is_active']      = $request->boolean('is_active', true);
        $data['tenant_id']      = $tenant->id;

        $product = Product::create($data);

        return response()->json($product, 201);
    }

    public function show(Product $product): JsonResponse
    {
        $this->authorizeProduct($product);
        return response()->json($product->load('category', 'subcategory'));
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->requirePermission('products', 'edit');
        $this->authorizeProduct($product);

        $request->validate([
            'name'           => 'sometimes|required|string|max:255',
            'unit'           => 'sometimes|required|string|max:30',
            'net_rate'       => 'sometimes|required|numeric|min:0',
            'gst_rate'       => 'sometimes|required|numeric|min:0|max:100',
            'description'    => 'nullable|string',
            'category_id'    => 'nullable|integer|exists:categories,id',
            'subcategory_id' => 'nullable|integer|exists:categories,id',
            'mrp'            => 'nullable|numeric|min:0',
            'sale_price'     => 'nullable|numeric|min:0',
            'is_active'      => 'nullable|boolean',
        ]);

        $newCode = null;
        if ($request->has('code')) {
            $newCode = trim((string) $request->code);
            if ($newCode !== '' && $newCode !== $product->code) {
                $exists = Product::where('tenant_id', $product->tenant_id)
                    ->where('code', $newCode)
                    ->where('id', '!=', $product->id)
                    ->exists();
                if ($exists) {
                    return response()->json([
                        'message' => 'The given data was invalid.',
                        'errors'  => ['code' => ["Product Code '{$newCode}' already exists for this organization."]]
                    ], 422);
                }
            }
        }

        $data = $request->except(['tenant_id', 'code']);
        if ($request->has('category_id')) {
            $data['category_id'] = $request->filled('category_id') ? (int) $request->category_id : null;
        }
        if ($request->has('subcategory_id')) {
            $data['subcategory_id'] = $request->filled('subcategory_id') ? (int) $request->subcategory_id : null;
        }
        if (!empty($newCode)) {
            $data['code'] = $newCode;
        }

        $product->update($data);
        return response()->json($product);
    }

    public function toggleActive(Product $product): JsonResponse
    {
        $this->requirePermission('products', 'edit');
        $this->authorizeProduct($product);
        $product->update(['is_active' => !$product->is_active]);
        return response()->json($product);
    }

    public function destroy(Product $product): JsonResponse
    {
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
