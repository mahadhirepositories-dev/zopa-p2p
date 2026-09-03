<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VendorFormTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorFormController extends Controller
{
    /**
     * List all form templates.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = app()->bound('currentTenant') ? app('currentTenant')->id : null;

        $templates = VendorFormTemplate::where('is_active', true)
            ->where(function ($q) use ($tenantId) {
                $q->whereNull('tenant_id');
                if ($tenantId) {
                    $q->orWhere('tenant_id', $tenantId);
                }
            })
            ->withCount(['invites', 'responses'])
            ->latest()
            ->get();

        return response()->json($templates);
    }

    /**
     * Store a new form template.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'vendor_type'       => 'nullable|string|max:50',
            'description'       => 'nullable|string',
            'schema_definition' => 'required|array|min:1',
            'schema_definition.*.field_key' => 'required|string|max:100',
            'schema_definition.*.label'     => 'required|string|max:255',
            'schema_definition.*.type'      => 'required|string|in:text,textarea,number,email,phone,select,multiselect,radio,checkbox,date,file',
            'schema_definition.*.required'  => 'boolean',
        ]);

        $tenantId = app()->bound('currentTenant') ? app('currentTenant')->id : null;

        $template = VendorFormTemplate::create([
            'tenant_id'         => $tenantId,
            'name'              => $validated['name'],
            'vendor_type'       => $validated['vendor_type'] ?? null,
            'description'       => $validated['description'] ?? null,
            'schema_definition' => $validated['schema_definition'],
            'is_active'         => true,
            'created_by'        => auth()->id(),
        ]);

        return response()->json($template, 201);
    }

    /**
     * Show a single form template.
     */
    public function show(VendorFormTemplate $form): JsonResponse
    {
        return response()->json($form->loadCount(['invites', 'responses']));
    }

    /**
     * Update/amend an existing template.
     */
    public function update(Request $request, VendorFormTemplate $form): JsonResponse
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'vendor_type'       => 'nullable|string|max:50',
            'description'       => 'nullable|string',
            'schema_definition' => 'required|array|min:1',
            'schema_definition.*.field_key' => 'required|string|max:100',
            'schema_definition.*.label'     => 'required|string|max:255',
            'schema_definition.*.type'      => 'required|string|in:text,textarea,number,email,phone,select,multiselect,radio,checkbox,date,file',
            'schema_definition.*.required'  => 'boolean',
        ]);

        $form->update([
            'name'              => $validated['name'],
            'vendor_type'       => $validated['vendor_type'] ?? null,
            'description'       => $validated['description'] ?? null,
            'schema_definition' => $validated['schema_definition'],
        ]);

        return response()->json($form->fresh());
    }

    /**
     * Duplicate an existing template to create a new copy.
     */
    public function duplicate(Request $request, VendorFormTemplate $form): JsonResponse
    {
        $newName = $request->input('name', 'Copy of ' . $form->name);
        $clone = $form->duplicate($newName, auth()->id());

        return response()->json($clone, 201);
    }

    /**
     * Soft-deactivate a template.
     */
    public function destroy(VendorFormTemplate $form): JsonResponse
    {
        $form->update(['is_active' => false]);
        return response()->json(['message' => 'Template deactivated successfully.']);
    }
}
