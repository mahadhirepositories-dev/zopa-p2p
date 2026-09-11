<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Move vendor 'SRI VISHNU BOOK CENTRE' to Apollo Vidhyalayam (AV).
     */
    public function up(): void
    {
        try {
            // ── 1. Resolve Tenants: AIVN and AV ──────────────────────────────────
            $aivnTenant = DB::table('tenants')
                ->where('id', 4)
                ->orWhere('name', 'LIKE', '%Apollo%Isha%')
                ->orWhere('name', 'LIKE', '%Niketan%')
                ->first();
            $aivnTenantId = $aivnTenant?->id ?? 4;

            $avTenant = DB::table('tenants')
                ->where('id', 7)
                ->orWhere(function ($q) {
                    $q->where('name', 'LIKE', '%Apollo%Vidhyalayam%')
                      ->orWhere('code', 'LIKE', '%APOLLOVIDHYALAYAM%');
                })
                ->first();
            $avTenantId = $avTenant?->id ?? 7;

            echo "Tenant mapping: AIVN ID = {$aivnTenantId}, AV ID = {$avTenantId}\n";

            // ── 2. Find Vendor 'SRI VISHNU BOOK CENTRE' ───────────────────────────
            $vendors = DB::table('vendors')
                ->where(function ($q) {
                    $q->where('name', 'LIKE', '%SRI%VISHNU%BOOK%CENTRE%')
                      ->orWhere('name', 'LIKE', '%SRI%VISHNU%BOOK%CENTER%')
                      ->orWhere('name', 'LIKE', '%VISHNU%BOOK%')
                      ->orWhere('name', 'LIKE', '%SRI%VISHNU%')
                      ->orWhere('name', 'LIKE', '%VISHNU%');
                })
                ->get();

            if ($vendors->isEmpty()) {
                echo "Warning: No vendor found with 'VISHNU' in name.\n";
                return;
            }

            foreach ($vendors as $v) {
                echo "Processing vendor: ID={$v->id}, Name='{$v->name}', Current TenantID={$v->tenant_id}\n";

                // Check if already in AV
                if ($v->tenant_id == $avTenantId) {
                    DB::table('vendors')->where('id', $v->id)->update([
                        'is_active'  => true,
                        'updated_at' => now(),
                    ]);
                    echo "Vendor #{$v->id} is already in AV (Tenant {$avTenantId}). Ensured active.\n";
                    continue;
                }

                $origVendorId = $v->id;

                // Check if vendor already exists in AV
                $existingAvVendor = DB::table('vendors')
                    ->where('tenant_id', $avTenantId)
                    ->where('name', 'LIKE', '%' . trim($v->name) . '%')
                    ->first();

                // Map Category & Subcategory to AV if exists
                $targetCatId = null;
                if (!empty($v->category_id)) {
                    $origCat = DB::table('categories')->where('id', $v->category_id)->first();
                    if ($origCat) {
                        $avCat = DB::table('categories')
                            ->where('tenant_id', $avTenantId)
                            ->where('name', $origCat->name)
                            ->first();
                        $targetCatId = $avCat?->id;
                    }
                }

                $targetSubcatId = null;
                if (!empty($v->subcategory_id)) {
                    $origSubcat = DB::table('categories')->where('id', $v->subcategory_id)->first();
                    if ($origSubcat) {
                        $avSubcat = DB::table('categories')
                            ->where('tenant_id', $avTenantId)
                            ->where('name', $origSubcat->name)
                            ->first();
                        $targetSubcatId = $avSubcat?->id;
                    }
                }

                // Check how many POs reference this vendor
                $poCount = DB::table('purchase_orders')
                    ->where('vendor_id', $origVendorId)
                    ->count();

                echo "PO usage count for vendor #{$origVendorId}: {$poCount}\n";

                if ($existingAvVendor) {
                    $targetAvVendorId = $existingAvVendor->id;
                    DB::table('vendors')->where('id', $targetAvVendorId)->update([
                        'is_active'  => true,
                        'updated_at' => now(),
                    ]);
                    echo "Vendor already exists in AV as #{$targetAvVendorId}.\n";

                    // Ensure addresses exist in AV
                    $origAddresses = DB::table('vendor_addresses')->where('vendor_id', $origVendorId)->get();
                    $avAddresses = DB::table('vendor_addresses')->where('vendor_id', $targetAvVendorId)->get();
                    if ($avAddresses->isEmpty() && $origAddresses->isNotEmpty()) {
                        foreach ($origAddresses as $addr) {
                            $addrData = (array) $addr;
                            unset($addrData['id']);
                            $addrData['vendor_id']  = $targetAvVendorId;
                            $addrData['created_at'] = now();
                            $addrData['updated_at'] = now();
                            DB::table('vendor_addresses')->insert($addrData);
                        }
                        echo "Copied " . count($origAddresses) . " address(es) to AV vendor #{$targetAvVendorId}.\n";
                    }
                } elseif ($poCount === 0) {
                    // Direct move: change tenant_id to AV
                    DB::table('vendors')->where('id', $origVendorId)->update([
                        'tenant_id'      => $avTenantId,
                        'category_id'    => $targetCatId ?? $v->category_id,
                        'subcategory_id' => $targetSubcatId ?? $v->subcategory_id,
                        'is_active'      => true,
                        'updated_at'     => now(),
                    ]);
                    $targetAvVendorId = $origVendorId;
                    echo "Vendor #{$origVendorId} moved directly to AV (Tenant {$avTenantId}).\n";
                } else {
                    // Has existing POs in original tenant: create active clone in AV
                    $vendorData = (array) $v;
                    unset($vendorData['id']);
                    $vendorData['tenant_id']      = $avTenantId;
                    $vendorData['category_id']    = $targetCatId ?? $v->category_id;
                    $vendorData['subcategory_id'] = $targetSubcatId ?? $v->subcategory_id;
                    $vendorData['is_active']      = true;
                    $vendorData['created_at']     = now();
                    $vendorData['updated_at']     = now();

                    $targetAvVendorId = DB::table('vendors')->insertGetId($vendorData);

                    // Copy vendor addresses
                    $origAddresses = DB::table('vendor_addresses')->where('vendor_id', $origVendorId)->get();
                    foreach ($origAddresses as $addr) {
                        $addrData = (array) $addr;
                        unset($addrData['id']);
                        $addrData['vendor_id']  = $targetAvVendorId;
                        $addrData['created_at'] = now();
                        $addrData['updated_at'] = now();
                        DB::table('vendor_addresses')->insert($addrData);
                    }

                    // Copy vendor categories
                    if (Schema::hasTable('vendor_categories')) {
                        $vCats = DB::table('vendor_categories')->where('vendor_id', $origVendorId)->get();
                        foreach ($vCats as $vc) {
                            $vcData = (array) $vc;
                            unset($vcData['id']);
                            $vcData['vendor_id']  = $targetAvVendorId;
                            $vcData['created_at'] = now();
                            $vcData['updated_at'] = now();
                            DB::table('vendor_categories')->insert($vcData);
                        }
                    }

                    // Copy vendor documents
                    if (Schema::hasTable('vendor_documents')) {
                        $vDocs = DB::table('vendor_documents')->where('vendor_id', $origVendorId)->get();
                        foreach ($vDocs as $vd) {
                            $vdData = (array) $vd;
                            unset($vdData['id']);
                            $vdData['vendor_id']  = $targetAvVendorId;
                            $vdData['created_at'] = now();
                            $vdData['updated_at'] = now();
                            DB::table('vendor_documents')->insert($vdData);
                        }
                    }

                    echo "Vendor #{$origVendorId} cloned to AV as Vendor #{$targetAvVendorId} with addresses and categories.\n";
                }

                // If any PO in Apollo Vidhyalayam references the old vendor, update to the AV vendor
                $avDefaultAddr = DB::table('vendor_addresses')
                    ->where('vendor_id', $targetAvVendorId)
                    ->orderByDesc('is_default')
                    ->first();

                $updatedAvPos = DB::table('purchase_orders')
                    ->where('tenant_id', $avTenantId)
                    ->where('vendor_id', $origVendorId)
                    ->update([
                        'vendor_id'         => $targetAvVendorId,
                        'vendor_address_id' => $avDefaultAddr?->id ?? DB::raw('vendor_address_id'),
                        'updated_at'        => now(),
                    ]);

                if ($updatedAvPos > 0) {
                    echo "Updated {$updatedAvPos} AV PO(s) to reference AV vendor #{$targetAvVendorId}.\n";
                }
            }

            Cache::flush();
            echo "Vendor migration to AV finished successfully.\n";
        } catch (\Throwable $e) {
            echo "Migration Notice: " . $e->getMessage() . "\n";
        }
    }

    public function down(): void
    {
        // No-op
    }
};
