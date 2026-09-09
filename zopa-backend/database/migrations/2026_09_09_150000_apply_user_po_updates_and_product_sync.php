<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use App\Services\GstService;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * 1. PO TH/2026-27/113 (Total Health):
     *    - Add Freight/Transportation = 7700.00
     *    - Recalculate PO totals and update budget ledger
     *
     * 2. PO AV/2026-27/23:
     *    - Transfer from Apollo Isha Vidhya Niketan to Apollo Vidhyalayam
     *    - Update tenant_id, cost_center_id, bill_to_location_id, ship_to_location_id, vendor_id
     *    - Transfer pending approval records to the appropriate approver
     *
     * 3. Copy all products from Apollo Isha Vidhya Niketan to Apollo Vidhyalayam
     *    - Copy categories and subcategories
     *    - Copy products with all master data (code, name, unit, rates, HSN, etc.)
     */
    public function up(): void
    {
        $gstService = app(GstService::class);

        // ══════════════════════════════════════════════════════════════════════
        // PART 1: PO TH/2026-27/113 — Add Transportation (Freight) 7,700
        // ══════════════════════════════════════════════════════════════════════
        $posTh113 = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/113')
                  ->orWhere('po_number', 'LIKE', '%TH%113%');
            })
            ->get();

        foreach ($posTh113 as $po) {
            $poId = $po->id;
            $freight = 7700.00;
            $freightGstRate = (float) ($po->freight_gst_rate ?? 0);

            // Fetch line items
            $items = DB::table('po_items')->where('po_id', $poId)->orderBy('sno')->get();
            $vendorAddress = DB::table('vendor_addresses')->where('id', $po->vendor_address_id)->first();
            $billToLocation = DB::table('locations')->where('id', $po->bill_to_location_id)->first();

            $vendorStateCode = $vendorAddress?->state_code ?? '';
            $companyStateCode = $billToLocation?->state_code ?? '';

            $itemsArray = [];
            foreach ($items as $it) {
                $itemsArray[] = [
                    'net_rate' => (float) $it->net_rate,
                    'qty'      => (float) $it->qty,
                    'gst_rate' => (float) $it->gst_rate,
                ];
            }

            $totals = $gstService->calculatePoTotals(
                $itemsArray,
                $freight,
                $vendorStateCode,
                $companyStateCode,
                $freightGstRate,
                (float) ($po->discount ?? 0)
            );

            DB::table('purchase_orders')->where('id', $poId)->update([
                'freight'     => $totals['freight'],
                'net_total'   => $totals['net_total'],
                'tax_amount'  => $totals['tax_amount'],
                'discount'    => $totals['discount'],
                'grand_total' => $totals['grand_total'],
                'round_off'   => $totals['round_off'],
                'updated_at'  => now(),
            ]);

            // Update Budget Ledger if entry exists for this PO
            if (Schema::hasTable('budget_ledger')) {
                DB::table('budget_ledger')
                    ->where('reference_type', 'PO')
                    ->where('reference_id', $poId)
                    ->where('action', 'freeze')
                    ->update([
                        'freeze_amount' => $totals['grand_total'],
                        'updated_at'    => now(),
                    ]);

                DB::table('budget_ledger')
                    ->where('reference_type', 'PO')
                    ->where('reference_id', $poId)
                    ->where('action', 'consume')
                    ->update([
                        'consume_amount' => $totals['grand_total'],
                        'updated_at'     => now(),
                    ]);
            }
        }


        // ══════════════════════════════════════════════════════════════════════
        // RESOLVE TENANTS: Apollo Isha Vidhya Niketan & Apollo Vidhyalayam
        // ══════════════════════════════════════════════════════════════════════
        $aivnTenant = DB::table('tenants')
            ->where('name', 'LIKE', '%Apollo%Isha%')
            ->orWhere('name', 'LIKE', '%Niketan%')
            ->first();

        $avTenant = DB::table('tenants')
            ->where('id', 7)
            ->orWhere(function ($q) {
                $q->where('name', 'LIKE', '%Apollo%Vidhyalayam%')
                  ->orWhere('name', 'LIKE', '%Apollo%Vidhyala%')
                  ->orWhere('code', 'LIKE', '%APOLLOVIDHYALAYAM%');
            })
            ->first();

        // ══════════════════════════════════════════════════════════════════════
        // PART 2: MOVE PO AV/2026-27/23 FROM AIVN TO AV
        // ══════════════════════════════════════════════════════════════════════
        if ($avTenant) {
            $posAv23 = DB::table('purchase_orders')
                ->where('po_number', 'AV/2026-27/23')
                ->orWhere('po_number', 'LIKE', '%2026-27/23%')
                ->get();

            // Find or get Default Cost Center for Apollo Vidhyalayam
            $avCostCenter = DB::table('cost_centers')
                ->where('tenant_id', $avTenant->id)
                ->where('is_active', true)
                ->first();

            if (!$avCostCenter) {
                $avCostCenter = DB::table('cost_centers')
                    ->where('tenant_id', $avTenant->id)
                    ->first();
            }

            if (!$avCostCenter) {
                $avCostCenterId = DB::table('cost_centers')->insertGetId([
                    'tenant_id'           => $avTenant->id,
                    'name'                => 'Default Cost Center',
                    'annual_budget'       => 0,
                    'current_fiscal_year' => '2026-2027',
                    'is_active'           => true,
                    'created_at'          => now(),
                    'updated_at'          => now(),
                ]);
                $avCostCenter = DB::table('cost_centers')->where('id', $avCostCenterId)->first();
            }

            // Find or get Location for Apollo Vidhyalayam
            $avLocation = DB::table('locations')
                ->where('tenant_id', $avTenant->id)
                ->first();

            foreach ($posAv23 as $po) {
                $poId = $po->id;

                // Vendor: Ensure the vendor exists or is mapped to Apollo Vidhyalayam
                $vendor = DB::table('vendors')->where('id', $po->vendor_id)->first();
                $targetVendorId = $po->vendor_id;
                $targetVendorAddressId = $po->vendor_address_id;

                if ($vendor && $vendor->tenant_id != $avTenant->id) {
                    $avVendor = DB::table('vendors')
                        ->where('tenant_id', $avTenant->id)
                        ->where(function ($q) use ($vendor) {
                            $q->where('name', $vendor->name)
                              ->orWhere('gstin', $vendor->gstin);
                        })
                        ->first();

                    if (!$avVendor) {
                        $vendorData = (array) $vendor;
                        unset($vendorData['id']);
                        $vendorData['tenant_id'] = $avTenant->id;
                        $vendorData['created_at'] = now();
                        $vendorData['updated_at'] = now();
                        $targetVendorId = DB::table('vendors')->insertGetId($vendorData);

                        // Copy vendor addresses
                        $origAddresses = DB::table('vendor_addresses')->where('vendor_id', $vendor->id)->get();
                        foreach ($origAddresses as $addr) {
                            $addrData = (array) $addr;
                            unset($addrData['id']);
                            $addrData['vendor_id'] = $targetVendorId;
                            $newAddrId = DB::table('vendor_addresses')->insertGetId($addrData);
                            if ($addr->id == $po->vendor_address_id) {
                                $targetVendorAddressId = $newAddrId;
                            }
                        }
                    } else {
                        $targetVendorId = $avVendor->id;
                        $avVendorAddr = DB::table('vendor_addresses')->where('vendor_id', $avVendor->id)->first();
                        if ($avVendorAddr) {
                            $targetVendorAddressId = $avVendorAddr->id;
                        }
                    }
                }

                // Update PO tenant, cost center, and locations
                $updateData = [
                    'tenant_id'      => $avTenant->id,
                    'cost_center_id' => $avCostCenter->id,
                    'vendor_id'      => $targetVendorId,
                    'vendor_address_id' => $targetVendorAddressId,
                    'updated_at'     => now(),
                ];

                if ($avLocation) {
                    $updateData['bill_to_location_id'] = $avLocation->id;
                    $updateData['ship_to_location_id'] = $avLocation->id;
                }

                DB::table('purchase_orders')->where('id', $poId)->update($updateData);

                // Update Approvals for PO AV/2026-27/23:
                // Find configured approver for Apollo Vidhyalayam cost center
                $avApprovalConfig = DB::table('approval_configs')
                    ->where('cost_center_id', $avCostCenter->id)
                    ->where('type', 'po')
                    ->where('level', 1)
                    ->where('is_active', true)
                    ->first();

                $targetApproverId = null;
                if ($avApprovalConfig) {
                    if (!empty($avApprovalConfig->user_ids)) {
                        $ids = is_string($avApprovalConfig->user_ids) ? json_decode($avApprovalConfig->user_ids, true) : $avApprovalConfig->user_ids;
                        $targetApproverId = $ids[0] ?? $avApprovalConfig->user_id;
                    } else {
                        $targetApproverId = $avApprovalConfig->user_id;
                    }
                }

                // If no config on cost center, look for tenant user with client_approver role
                if (!$targetApproverId) {
                    $approverRole = DB::table('user_tenant_roles')
                        ->where('tenant_id', $avTenant->id)
                        ->whereIn('role', ['client_approver', 'client_admin', 'approver', 'admin'])
                        ->where('is_active', true)
                        ->first();
                    $targetApproverId = $approverRole?->user_id;
                }

                if ($targetApproverId) {
                    DB::table('approvals')
                        ->where('entity_type', 'PO')
                        ->where('entity_id', $poId)
                        ->where('action', 'pending')
                        ->update([
                            'assigned_to_user_id' => $targetApproverId,
                            'updated_at'          => now(),
                        ]);
                }
            }
        }


        // ══════════════════════════════════════════════════════════════════════
        // PART 3: COPY ALL PRODUCTS FROM AIVN TO APOLLO VIDHYALAYAM
        // ══════════════════════════════════════════════════════════════════════
        if ($aivnTenant && $avTenant) {
            // 3.1 Copy Categories first (parent categories then child subcategories)
            $aivnCategories = DB::table('categories')
                ->where('tenant_id', $aivnTenant->id)
                ->whereNull('parent_id')
                ->get();

            $categoryMap = []; // old_id => new_id

            foreach ($aivnCategories as $cat) {
                $existing = DB::table('categories')
                    ->where('tenant_id', $avTenant->id)
                    ->where('name', $cat->name)
                    ->whereNull('parent_id')
                    ->first();

                if ($existing) {
                    $categoryMap[$cat->id] = $existing->id;
                } else {
                    $newId = DB::table('categories')->insertGetId([
                        'tenant_id'  => $avTenant->id,
                        'name'       => $cat->name,
                        'parent_id'  => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $categoryMap[$cat->id] = $newId;
                }
            }

            // Subcategories
            $aivnSubcategories = DB::table('categories')
                ->where('tenant_id', $aivnTenant->id)
                ->whereNotNull('parent_id')
                ->get();

            foreach ($aivnSubcategories as $sub) {
                $newParentId = $categoryMap[$sub->parent_id] ?? null;

                $existing = DB::table('categories')
                    ->where('tenant_id', $avTenant->id)
                    ->where('name', $sub->name)
                    ->where('parent_id', $newParentId)
                    ->first();

                if ($existing) {
                    $categoryMap[$sub->id] = $existing->id;
                } else {
                    $newId = DB::table('categories')->insertGetId([
                        'tenant_id'  => $avTenant->id,
                        'name'       => $sub->name,
                        'parent_id'  => $newParentId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $categoryMap[$sub->id] = $newId;
                }
            }

            // 3.2 Copy all Products from AIVN to AV
            $aivnProducts = DB::table('products')
                ->where('tenant_id', $aivnTenant->id)
                ->get();

            foreach ($aivnProducts as $prod) {
                // Check if product already exists in Apollo Vidhyalayam by code or name
                $existingProd = DB::table('products')
                    ->where('tenant_id', $avTenant->id)
                    ->where(function ($q) use ($prod) {
                        if (!empty($prod->code)) {
                            $q->where('code', $prod->code)
                              ->orWhere('name', $prod->name);
                        } else {
                            $q->where('name', $prod->name);
                        }
                    })
                    ->first();

                $mappedCatId = $categoryMap[$prod->category_id] ?? null;
                $mappedSubcatId = $categoryMap[$prod->subcategory_id] ?? null;

                if (!$existingProd) {
                    DB::table('products')->insert([
                        'tenant_id'       => $avTenant->id,
                        'code'            => $prod->code,
                        'name'            => $prod->name,
                        'description'     => $prod->description,
                        'category_id'     => $mappedCatId,
                        'subcategory_id'  => $mappedSubcatId,
                        'unit'            => $prod->unit,
                        'net_rate'        => $prod->net_rate,
                        'gst_rate'        => $prod->gst_rate,
                        'hsn_code'        => $prod->hsn_code,
                        'warranty_months' => $prod->warranty_months ?? 0,
                        'is_active'       => $prod->is_active,
                        'mrp'             => $prod->mrp ?? 0,
                        'sale_price'      => $prod->sale_price ?? 0,
                        'created_at'      => now(),
                        'updated_at'      => now(),
                    ]);
                } else {
                    // Keep master fields synced if already present
                    DB::table('products')->where('id', $existingProd->id)->update([
                        'net_rate'        => $prod->net_rate,
                        'gst_rate'        => $prod->gst_rate,
                        'hsn_code'        => $prod->hsn_code,
                        'unit'            => $prod->unit,
                        'category_id'     => $mappedCatId,
                        'subcategory_id'  => $mappedSubcatId,
                        'is_active'       => $prod->is_active,
                        'updated_at'      => now(),
                    ]);
                }
            }
        }

        Cache::flush();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
