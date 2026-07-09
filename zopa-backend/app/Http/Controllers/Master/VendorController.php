<?php

namespace App\Http\Controllers\Master;

use App\Exports\VendorTemplateExport;
use App\Http\Controllers\Controller;
use App\Imports\VendorsImport;
use App\Models\Vendor;
use App\Models\VendorAddress;
use App\Models\VendorCategory;
use App\Models\VendorDocument;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class VendorController extends Controller
{
    use AuthorizesRoles;

    public function __construct(private \App\Services\ActivityLogService $actLog) {}

    private array $VENDOR_FIELDS = [
        'name', 'global_vendor_code', 'entity_code', 'vendor_type', 'entity_type',
        'pan', 'pan_not_available', 'gst_status', 'gstin',
        'email', 'phone', 'currency',
        'account_no', 'ifsc', 'micr', 'bank_name', 'branch_name',
        'special_status', 'special_status_reg_no',
        'special_status_start_date', 'special_status_end_date',
        'category_id', 'subcategory_id', 'is_active',
    ];

    public function index(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            Vendor::where('tenant_id', $tenant->id)
                ->with(['addresses', 'category:id,name', 'subcategory:id,name',
                        'vendorCategories.category:id,name', 'vendorCategories.subcategory:id,name'])
                ->get()
        );
    }

    public function export(Request $request)
    {
        $this->requirePermission('vendors', 'view');
        $tenant = app('currentTenant');
        
        $query = Vendor::where('tenant_id', $tenant->id)
                ->with(['category:id,name', 'subcategory:id,name']);

        $data = $query->latest()->get()->map(fn($v) => [
            'Vendor Name' => $v->name,
            'Global Code' => $v->global_vendor_code,
            'Email' => $v->email,
            'Phone' => $v->phone,
            'Category' => optional($v->category)->name,
            'Subcategory' => optional($v->subcategory)->name,
            'Status' => $v->is_active ? 'Active' : 'Inactive',
        ]);

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\GenericExport($data, ['Vendor Name', 'Global Code', 'Email', 'Phone', 'Category', 'Subcategory', 'Status']),
            'vendors.xlsx'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('vendors', 'create');
        $this->validateVendor($request);

        $tenant = app('currentTenant');

        $code = $request->global_vendor_code;
        if (empty($code)) {
            $prefix = 'ZP-' . date('y') . date('m') . '-';
            do {
                $maxSeq = Vendor::where('tenant_id', $tenant->id)
                    ->where('global_vendor_code', 'like', $prefix . '%')
                    ->get()
                    ->map(function ($v) use ($prefix) {
                        return (int) str_replace($prefix, '', $v->global_vendor_code);
                    })
                    ->max() ?? 0;
                $code = $prefix . str_pad($maxSeq + 1, 2, '0', STR_PAD_LEFT);
            } while (Vendor::where('tenant_id', $tenant->id)->where('global_vendor_code', $code)->exists());
        }

        $vendor = Vendor::create([
            ...$request->only($this->VENDOR_FIELDS),
            'global_vendor_code' => $code,
            'tenant_id' => $tenant->id,
        ]);

        $this->syncCategories($vendor, $request->input('vendor_categories', []));

        $this->actLog->log('VENDOR', $vendor->id, 'created', ['name' => $vendor->name]);

        return response()->json($vendor->load(['vendorCategories.category', 'vendorCategories.subcategory']), 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        $this->authorizeVendor($vendor);
        return response()->json($vendor->load([
            'addresses',
            'category:id,name', 'subcategory:id,name',
            'vendorCategories.category:id,name',
            'vendorCategories.subcategory:id,name',
            'documents',
        ]));
    }

    public function update(Request $request, Vendor $vendor): JsonResponse
    {
        $this->requirePermission('vendors', 'edit');
        $this->authorizeVendor($vendor);
        $this->validateVendor($request, partial: true, ignoreId: $vendor->id);

        $vendor->fill($request->only($this->VENDOR_FIELDS));
        $dirty = [];
        foreach ($this->VENDOR_FIELDS as $field) {
            if ($vendor->isDirty($field)) {
                $dirty[$field] = [
                    'old' => $vendor->getOriginal($field),
                    'new' => $vendor->getAttribute($field)
                ];
            }
        }
        $vendor->save();

        if ($request->has('vendor_categories')) {
            $this->syncCategories($vendor, $request->input('vendor_categories', []));
        }

        if (!empty($dirty)) {
            $this->actLog->log('VENDOR', $vendor->id, 'updated', ['changes' => $dirty]);
        }

        return response()->json($vendor->fresh()->load([
            'vendorCategories.category:id,name',
            'vendorCategories.subcategory:id,name',
        ]));
    }

    public function destroy(Vendor $vendor): JsonResponse
    {
        $this->requirePermission('vendors', 'delete');
        $this->authorizeVendor($vendor);
        $vendor->update(['is_active' => false]);
        $this->actLog->log('VENDOR', $vendor->id, 'deactivated');
        return response()->json(null, 204);
    }

    public function activity(Vendor $vendor): JsonResponse
    {
        $this->authorizeVendor($vendor);
        return response()->json($this->actLog->forEntity('VENDOR', $vendor->id));
    }

    // ── Documents ────────────────────────────────────────────────────────────

    public function uploadDocument(Request $request, Vendor $vendor): JsonResponse
    {
        $this->requirePermission('vendors', 'edit');
        $this->authorizeVendor($vendor);

        $request->validate([
            'document'      => 'required|file|max:10240', // 10MB
            'document_type' => 'required|in:pan,gst,cancelled_cheque,additional',
        ]);

        // Limit additional docs to 5
        if ($request->document_type === 'additional') {
            $additionalCount = $vendor->documents()->where('document_type', 'additional')->count();
            if ($additionalCount >= 5) {
                return response()->json(['error' => 'Maximum 5 additional documents allowed.'], 422);
            }
        }

        $file = $request->file('document');
        $originalName = $file->getClientOriginalName();

        // CR-V5: Prevent duplicate uploads — reject if same filename already exists for this vendor
        $duplicateExists = $vendor->documents()
            ->where('original_name', $originalName)
            ->exists();
        if ($duplicateExists) {
            return response()->json([
                'error' => "A file named \"{$originalName}\" is already attached to this vendor. Delete the existing file before re-uploading.",
            ], 422);
        }

        $path = $file->store("vendors/{$vendor->id}/documents", 'public');

        $doc = VendorDocument::create([
            'vendor_id'     => $vendor->id,
            'document_type' => $request->document_type,
            'file_name'     => basename($path),
            'original_name' => $file->getClientOriginalName(),
            'file_path'     => $path,
            'size'          => $file->getSize(),
            'uploaded_by'   => auth()->id(),
        ]);

        $doc->url = Storage::url($path);
        return response()->json($doc, 201);
    }

    public function deleteDocument(Vendor $vendor, VendorDocument $document): JsonResponse
    {
        $this->requirePermission('vendors', 'edit');
        $this->authorizeVendor($vendor);
        abort_if($document->vendor_id !== $vendor->id, 404);
        Storage::disk('public')->delete($document->file_path);
        $document->delete();
        return response()->json(null, 204);
    }

    // ── Addresses ────────────────────────────────────────────────────────────

    public function addresses(Vendor $vendor): JsonResponse
    {
        $this->authorizeVendor($vendor);
        return response()->json($vendor->addresses);
    }

    public function storeAddress(Request $request, Vendor $vendor): JsonResponse
    {
        $this->requirePermission('vendors', 'edit');
        $this->authorizeVendor($vendor);

        $request->validate([
            'label'         => 'required|string',
            'address'       => 'nullable|string',
            'pincode'       => 'nullable|string|max:20',
            'city'          => 'nullable|string|max:100',
            'state'         => 'nullable|string',
            'state_code'    => 'nullable|string|max:5',
            'country'       => 'nullable|string|max:100',
            'gstin'         => ['nullable', 'string', 'regex:/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/'],
            'contact_phone' => 'nullable|string',
        ]);

        if ($request->boolean('is_default')) {
            $vendor->addresses()->update(['is_default' => false]);
        }

        $address = $vendor->addresses()->create($request->only(
            'label', 'address', 'pincode', 'city', 'state', 'state_code',
            'country', 'gstin', 'contact_name', 'contact_phone', 'is_default'
        ));

        return response()->json($address, 201);
    }

    public function updateAddress(Request $request, Vendor $vendor, VendorAddress $address): JsonResponse
    {
        $this->requirePermission('vendors', 'edit');
        $this->authorizeVendor($vendor);
        abort_if($address->vendor_id !== $vendor->id, 404);

        $request->validate([
            'label'         => 'required|string',
            'address'       => 'nullable|string',
            'pincode'       => 'nullable|string|max:20',
            'city'          => 'nullable|string|max:100',
            'state'         => 'nullable|string',
            'state_code'    => 'nullable|string|max:5',
            'country'       => 'nullable|string|max:100',
            'gstin'         => ['nullable', 'string', 'regex:/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/'],
            'contact_phone' => 'nullable|string',
        ]);

        if ($request->boolean('is_default')) {
            $vendor->addresses()->where('id', '!=', $address->id)->update(['is_default' => false]);
        }

        $address->update($request->only(
            'label', 'address', 'pincode', 'city', 'state', 'state_code',
            'country', 'gstin', 'contact_name', 'contact_phone', 'is_default'
        ));

        return response()->json($address->fresh());
    }

    public function destroyAddress(Vendor $vendor, VendorAddress $address): JsonResponse
    {
        $this->requirePermission('vendors', 'edit');
        $this->authorizeVendor($vendor);
        abort_if($address->vendor_id !== $vendor->id, 404);
        $address->delete();
        return response()->json(null, 204);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function validateVendor(Request $request, bool $partial = false, ?int $ignoreId = null): void
    {
        $required = $partial ? 'nullable' : 'required';
        $tenantId = app('currentTenant')->id;

        $request->validate([
            'name'           => [
                $partial ? 'sometimes' : 'required',
                'string',
                'max:255',
                \Illuminate\Validation\Rule::unique('vendors', 'name')
                    ->where('tenant_id', $tenantId)
                    ->ignore($ignoreId)
            ],
            'pan'            => [
                'nullable',
                'string',
                'regex:/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/',
                \Illuminate\Validation\Rule::unique('vendors', 'pan')
                    ->where('tenant_id', $tenantId)
                    ->ignore($ignoreId)
            ],
            'gstin'          => [
                'nullable',
                'string',
                'regex:/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/',
                \Illuminate\Validation\Rule::unique('vendors', 'gstin')
                    ->where('tenant_id', $tenantId)
                    ->ignore($ignoreId)
            ],
            'email'          => 'nullable|email|max:100',
            'phone'          => ['nullable', 'string'],
            'gst_status'     => 'nullable|in:registered,unregistered,overseas',
            'vendor_type'    => 'nullable|in:manufacturer,distributor,service_provider,consultant',
            'entity_type'    => 'nullable|in:public,pvt_ltd,llp,partnership,individual,overseas_company,others',
            'currency'       => 'nullable|string|max:10',
            'special_status' => 'nullable|in:msme,non_msme,sez,others',
            'vendor_categories' => 'nullable|array',
            'vendor_categories.*.category_id'    => 'nullable|integer|exists:categories,id',
            'vendor_categories.*.subcategory_id' => 'nullable|integer|exists:categories,id',
        ]);
    }

    private function syncCategories(Vendor $vendor, array $categories): void
    {
        $vendor->vendorCategories()->delete();
        foreach ($categories as $cat) {
            if (!empty($cat['category_id'])) {
                VendorCategory::create([
                    'vendor_id'      => $vendor->id,
                    'category_id'    => $cat['category_id'],
                    'subcategory_id' => $cat['subcategory_id'] ?? null,
                ]);
            }
        }
    }

    /** Download the Excel bulk-import template (categories + allowed values sheets). */
    public function template(): BinaryFileResponse
    {
        $this->requirePermission('vendors', 'view');
        return Excel::download(
            new VendorTemplateExport(app('currentTenant')->id),
            'vendor-import-template.xlsx'
        );
    }

    /** Bulk-import vendors from a filled-in template. */
    public function import(Request $request): JsonResponse
    {
        $this->requirePermission('vendors', 'create');
        $request->validate(['file' => 'required|file|mimes:xlsx,xls,csv|max:5120']);

        $import = new VendorsImport(app('currentTenant')->id);
        Excel::import($import, $request->file('file'));

        return response()->json([
            'created' => $import->created,
            'skipped' => count($import->errors),
            'errors'  => $import->errors,
            'message' => "Imported {$import->created} vendor(s)."
                . (count($import->errors) ? ' ' . count($import->errors) . ' row(s) skipped — see details.' : ''),
        ]);
    }

    private function authorizeVendor(Vendor $vendor): void
    {
        abort_if($vendor->tenant_id !== app('currentTenant')->id, 403);
    }
}
