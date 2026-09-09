<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * 1. Move PO #120 (and linked PR #91 / PR15) from Apollo Isha Vidhya Niketan to Apollo Vidhyalayam:
     *    - Update tenant_id to 7 (Apollo Vidhyalayam)
     *    - Update cost_center_id to Apollo Vidhyalayam cost center
     *    - Update bill_to_location_id and ship_to_location_id to Apollo Vidhyalayam location
     *    - Map / ensure vendor and vendor_address belong to Apollo Vidhyalayam
     *    - Map po_items to matching products in Apollo Vidhyalayam
     *
     * 2. Rename all product codes in Apollo Vidhyalayam (tenant_id = 7):
     *    - Replace 'AIVN' or 'AIV' prefix with 'AV' (e.g., AIVN101 -> AV101)
     *    - Update po_items.product_code where matching
     *    - Set tenant product_prefix = 'AV' if applicable
     */
    public function up(): void
    {
        // ── 1. Resolve Tenants ────────────────────────────────────────────────
        $aivnTenant = DB::table('tenants')
            ->where('id', 4)
            ->orWhere(function ($q) {
                $q->where('name', 'LIKE', '%Apollo%Isha%')
                  ->orWhere('name', 'LIKE', '%Niketan%');
            })
            ->first();

        $avTenant = DB::table('tenants')
            ->where('id', 7)
            ->orWhere(function ($q) {
                $q->where('name', 'LIKE', '%Apollo%Vidhyalayam%')
                  ->orWhere('code', 'LIKE', '%APOLLOVIDHYALAYAM%');
            })
            ->first();

        if (!$avTenant) {
            return;
        }

        $avTenantId = $avTenant->id;

        // Ensure Apollo Vidhyalayam product_prefix is 'AV'
        if (Schema::hasColumn('tenants', 'product_prefix')) {
            DB::table('tenants')->where('id', $avTenantId)->update([
                'product_prefix' => 'AV',
                'updated_at'     => now(),
            ]);
        }

        // ── 2. Update all Product Codes in Apollo Vidhyalayam to 'AV' ─────────
        $avProducts = DB::table('products')->where('tenant_id', $avTenantId)->get();

        foreach ($avProducts as $prod) {
            $oldCode = $prod->code;
            if (!$oldCode) continue;

            $newCode = null;
            if (str_starts_with($oldCode, 'AIVN')) {
                $newCode = 'AV' . substr($oldCode, 4);
            } elseif (str_starts_with($oldCode, 'AIV')) {
                $newCode = 'AV' . substr($oldCode, 3);
            }

            if ($newCode && $newCode !== $oldCode) {
                DB::table('products')->where('id', $prod->id)->update([
                    'code'       => $newCode,
                    'updated_at' => now(),
                ]);
            }
        }

        // ── 3. Resolve Location & Cost Center for Apollo Vidhyalayam ──────────
        $avLocation = DB::table('locations')
            ->where('tenant_id', $avTenantId)
            ->where('name', 'LIKE', '%Apollo%Vidhyalayam%')
            ->first();

        if (!$avLocation) {
            $avLocation = DB::table('locations')->where('tenant_id', $avTenantId)->first();
        }

        $avCostCenter = DB::table('cost_centers')
            ->where('tenant_id', $avTenantId)
            ->where('is_active', true)
            ->first();

        if (!$avCostCenter) {
            $avCostCenter = DB::table('cost_centers')->where('tenant_id', $avTenantId)->first();
        }

        // ── 4. Move PO #120 to Apollo Vidhyalayam ──────────────────────────────
        $po120 = DB::table('purchase_orders')->where('id', 120)->first();

        if ($po120) {
            // Vendor & Vendor Address mapping
            $targetVendorId = $po120->vendor_id;
            $targetVendorAddressId = $po120->vendor_address_id;

            $vendor = DB::table('vendors')->where('id', $po120->vendor_id)->first();
            if ($vendor && $vendor->tenant_id != $avTenantId) {
                $avVendor = DB::table('vendors')
                    ->where('tenant_id', $avTenantId)
                    ->where(function ($q) use ($vendor) {
                        $q->where('name', $vendor->name)
                          ->orWhere('gstin', $vendor->gstin);
                    })
                    ->first();

                if (!$avVendor) {
                    $vendorData = (array) $vendor;
                    unset($vendorData['id']);
                    $vendorData['tenant_id'] = $avTenantId;
                    $vendorData['created_at'] = now();
                    $vendorData['updated_at'] = now();
                    $targetVendorId = DB::table('vendors')->insertGetId($vendorData);

                    $origAddresses = DB::table('vendor_addresses')->where('vendor_id', $vendor->id)->get();
                    foreach ($origAddresses as $addr) {
                        $addrData = (array) $addr;
                        unset($addrData['id']);
                        $addrData['vendor_id'] = $targetVendorId;
                        $newAddrId = DB::table('vendor_addresses')->insertGetId($addrData);
                        if ($addr->id == $po120->vendor_address_id) {
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

            $updatePoData = [
                'tenant_id'         => $avTenantId,
                'cost_center_id'    => $avCostCenter?->id ?? $po120->cost_center_id,
                'vendor_id'         => $targetVendorId,
                'vendor_address_id' => $targetVendorAddressId,
                'updated_at'        => now(),
            ];

            if ($avLocation) {
                $updatePoData['bill_to_location_id'] = $avLocation->id;
                $updatePoData['ship_to_location_id'] = $avLocation->id;
            }

            DB::table('purchase_orders')->where('id', 120)->update($updatePoData);

            // Update line items in PO 120
            $po120Items = DB::table('po_items')->where('po_id', 120)->get();
            foreach ($po120Items as $item) {
                $itemUpdate = [];

                // Map product_id to Apollo Vidhyalayam product
                if ($item->product_id) {
                    $oldProd = DB::table('products')->where('id', $item->product_id)->first();
                    if ($oldProd && $oldProd->tenant_id != $avTenantId) {
                        // Find matching product in Apollo Vidhyalayam
                        $avProd = DB::table('products')
                            ->where('tenant_id', $avTenantId)
                            ->where(function ($q) use ($oldProd) {
                                $q->where('name', $oldProd->name);
                            })
                            ->first();

                        if ($avProd) {
                            $itemUpdate['product_id']   = $avProd->id;
                            $itemUpdate['product_code'] = $avProd->code;
                            $itemUpdate['product_name'] = $avProd->name;
                        }
                    }
                }

                // If product_code still has AIVN / AIV, replace with AV
                $curCode = $itemUpdate['product_code'] ?? $item->product_code;
                if ($curCode) {
                    if (str_starts_with($curCode, 'AIVN')) {
                        $itemUpdate['product_code'] = 'AV' . substr($curCode, 4);
                    } elseif (str_starts_with($curCode, 'AIV')) {
                        $itemUpdate['product_code'] = 'AV' . substr($curCode, 3);
                    }
                }

                if (!empty($itemUpdate)) {
                    $itemUpdate['updated_at'] = now();
                    DB::table('po_items')->where('id', $item->id)->update($itemUpdate);
                }
            }

            // Also update any other PO line items in tenant 7 that might reference old codes
            $otherPoItems = DB::table('po_items')
                ->join('purchase_orders', 'purchase_orders.id', '=', 'po_items.po_id')
                ->where('purchase_orders.tenant_id', $avTenantId)
                ->where(function ($q) {
                    $q->where('po_items.product_code', 'LIKE', 'AIVN%')
                      ->orWhere('po_items.product_code', 'LIKE', 'AIV%');
                })
                ->select('po_items.id', 'po_items.product_code')
                ->get();

            foreach ($otherPoItems as $it) {
                $newC = null;
                if (str_starts_with($it->product_code, 'AIVN')) {
                    $newC = 'AV' . substr($it->product_code, 4);
                } elseif (str_starts_with($it->product_code, 'AIV')) {
                    $newC = 'AV' . substr($it->product_code, 3);
                }
                if ($newC) {
                    DB::table('po_items')->where('id', $it->id)->update([
                        'product_code' => $newC,
                        'updated_at'   => now(),
                    ]);
                }
            }
        }

        // ── 5. Move linked PR #91 (PR15) to Apollo Vidhyalayam ─────────────────
        $pr91 = DB::table('purchase_requisitions')
            ->where(function ($q) {
                $q->where('id', 91)
                  ->orWhere('pr_number', 'PR15')
                  ->orWhere('title', 'LIKE', '%AV-Signage Boards%');
            })
            ->first();

        if ($pr91) {
            $updatePr = [
                'tenant_id'  => $avTenantId,
                'updated_at' => now(),
            ];
            if ($avCostCenter) {
                $updatePr['cost_center_id'] = $avCostCenter->id;
            }
            if ($avLocation) {
                $updatePr['location_id'] = $avLocation->id;
            }
            DB::table('purchase_requisitions')->where('id', $pr91->id)->update($updatePr);

            // Update PR items product_id to Apollo Vidhyalayam
            $prItems = DB::table('pr_items')->where('pr_id', $pr91->id)->get();
            foreach ($prItems as $pi) {
                if ($pi->product_id) {
                    $origP = DB::table('products')->where('id', $pi->product_id)->first();
                    if ($origP && $origP->tenant_id != $avTenantId) {
                        $avP = DB::table('products')
                            ->where('tenant_id', $avTenantId)
                            ->where('name', $origP->name)
                            ->first();
                        if ($avP) {
                            DB::table('pr_items')->where('id', $pi->id)->update([
                                'product_id' => $avP->id,
                                'updated_at' => now(),
                            ]);
                        }
                    }
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
