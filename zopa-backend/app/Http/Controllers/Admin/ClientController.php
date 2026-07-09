<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ClientController extends Controller
{
    private function withLogoUrl(Tenant $tenant): array
    {
        $data = $tenant->toArray();
        $data['logo_url'] = $tenant->logo_path
            ? url(Storage::url($tenant->logo_path))
            : null;
        return $data;
    }

    public function index()
    {
        return response()->json(
            Tenant::all()->map(fn($t) => $this->withLogoUrl($t))
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:255',
            'code'               => 'required|string|max:50|unique:tenants,code',
            'gstin'              => 'nullable|string|max:50',
            'address_json'       => 'nullable|array',
            'po_prefix'          => 'nullable|string|max:50',
            'po_starting_series' => 'nullable|integer|min:1',
            'pr_prefix'          => 'nullable|string|max:50',
            'pr_starting_series' => 'nullable|integer|min:1',
            'product_prefix'     => 'nullable|string|max:20',
            'product_series'     => 'nullable|integer|min:1',
            'fiscal_year_start'  => 'nullable|string|max:10',
            'is_active'          => 'boolean',
            'is_internal'        => 'boolean',
        ]);

        $tenant = Tenant::create($validated);
        return response()->json($this->withLogoUrl($tenant), 201);
    }

    public function show($id)
    {
        $tenant = Tenant::findOrFail($id);
        return response()->json($this->withLogoUrl($tenant));
    }

    public function update(Request $request, $id)
    {
        $tenant = Tenant::findOrFail($id);

        $validated = $request->validate([
            'name'               => 'required|string|max:255',
            'code'               => 'required|string|max:50|unique:tenants,code,' . $tenant->id,
            'gstin'              => 'nullable|string|max:50',
            'address_json'       => 'nullable|array',
            'po_prefix'          => 'nullable|string|max:50',
            'po_starting_series' => 'nullable|integer|min:1',
            'pr_prefix'          => 'nullable|string|max:50',
            'pr_starting_series' => 'nullable|integer|min:1',
            'product_prefix'     => 'nullable|string|max:20',
            'product_series'     => 'nullable|integer|min:1',
            'fiscal_year_start'  => 'nullable|string|max:10',
            'is_active'          => 'boolean',
            'is_internal'        => 'boolean',
        ]);

        $tenant->update($validated);
        return response()->json($this->withLogoUrl($tenant));
    }

    public function uploadLogo(Request $request, $id)
    {
        $request->validate(['logo' => 'required|image|max:2048']);

        $tenant = Tenant::findOrFail($id);

        // Delete old logo if exists
        if ($tenant->logo_path) {
            Storage::disk('public')->delete($tenant->logo_path);
        }

        $path = $request->file('logo')->store("tenant-logos/{$id}", 'public');
        $tenant->update(['logo_path' => $path]);

        return response()->json($this->withLogoUrl($tenant));
    }
}
