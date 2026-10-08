<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Move PO TH/2026-27/162 from Total Health to Aragonda Vikas Trust:
     * 1. Resolve or create tenant "Aragonda Vikas Trust" (AVT).
     * 2. Generate next sequential PO number in Aragonda Vikas Trust series.
     * 3. Update PO tenant_id, po_number, cost_center_id, bill_to_location_id, ship_to_location_id.
     * 4. Map or copy vendor and vendor addresses to Aragonda Vikas Trust.
     * 5. Map line items and products to Aragonda Vikas Trust.
     * 6. Move any linked PR and its items to Aragonda Vikas Trust.
     * 7. Update approvals and budget ledger records.
     */
    public function up(): void
    {
        // ── 1. Resolve / Create Aragonda Vikas Trust Tenant ───────────────────
        $avtTenant = DB::table('tenants')
            ->where(function ($q) {
                $q->where('name', 'LIKE', '%Aragonda%Vikas%Trust%')
                  ->orWhere('name', 'LIKE', '%Aragonda%Vikas%')
                  ->orWhere('name', 'LIKE', '%Aragonda%')
                  ->orWhere('code', 'AVT')
                  ->orWhere('code', 'LIKE', '%AVT%');
            })
            ->first();

        if (!$avtTenant) {
            echo "Aragonda Vikas Trust tenant not found, creating tenant...\n";
            $avtTenantId = DB::table('tenants')->insertGetId([
                'name'               => 'Aragonda Vikas Trust',
                'code'               => 'AVT',
                'gstin'              => '',
                'po_prefix'          => 'AVT/2026-27/',
                'po_starting_series' => 1,
                'pr_prefix'          => 'AVTPR',
                'pr_starting_series' => 1,
                'product_prefix'     => 'AVT',
                'fiscal_year_start'  => 4,
                'is_active'          => true,
                'is_internal'        => false,
                'plan'               => 'enterprise',
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
            $avtTenant = DB::table('tenants')->where('id', $avtTenantId)->first();
        }

        $avtTenantId = $avtTenant->id;
        echo "Aragonda Vikas Trust Tenant: ID {$avtTenantId}, Name '{$avtTenant->name}', Code '{$avtTenant->code}'\n";

        // Ensure po_prefix is configured
        $prefix = $avtTenant->po_prefix ?: 'AVT/2026-27/';
        if (!$avtTenant->po_prefix) {
            DB::table('tenants')->where('id', $avtTenantId)->update([
                'po_prefix'  => $prefix,
                'updated_at' => now(),
            ]);
        }

        // ── 2. Find PO TH/2026-27/162 ─────────────────────────────────────────
        $targetPo = DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('po_number', 'TH/2026-27/162')
                  ->orWhere('po_number', 'TH-2026-27-162')
                  ->orWhere('po_number', 'LIKE', '%TH%162%')
                  ->orWhere('po_number', 'LIKE', '%/162');
            })
            ->first();

        if (!$targetPo) {
            echo "Warning: PO TH/2026-27/162 not found!\n";
            return;
        }

        $poId = $targetPo->id;
        $oldPoNumber = $targetPo->po_number;
        echo "Found target PO: ID {$poId}, Current Number '{$oldPoNumber}', Current Tenant {$targetPo->tenant_id}\n";

        // ── 3. Calculate Next Sequential PO Number in AVT series ──────────────
        $existingPoNumbers = DB::table('purchase_orders')
            ->where('tenant_id', $avtTenantId)
            ->where('id', '!=', $poId)
            ->whereNotNull('po_number')
            ->pluck('po_number');

        $maxSeq = 0;
        $padLen = 0;

        foreach ($existingPoNumbers as $poNum) {
            // Check matching prefix
            $numPart = null;
            if (str_starts_with($poNum, $prefix)) {
                $numPart = substr($poNum, strlen($prefix));
            } elseif (preg_match('/(\d+)$/', $poNum, $m)) {
                $numPart = $m[1];
            }

            if ($numPart && is_numeric($numPart)) {
                $val = (int) $numPart;
                if ($val > $maxSeq) {
                    $maxSeq = $val;
                    if (strlen($numPart) > 1 && str_starts_with($numPart, '0')) {
                        $padLen = strlen($numPart);
                    }
                }
            }
        }

        $startSeries = (int) ($avtTenant->po_starting_series ?? 1);
        $nextSeq = $maxSeq > 0 ? $maxSeq + 1 : $startSeries;
        $seqStr = $padLen > 0 ? str_pad((string)$nextSeq, $padLen, '0', STR_PAD_LEFT) : (string)$nextSeq;
        $newPoNumber = $prefix . $seqStr;

        echo "Generated next sequential PO number for AVT: '{$newPoNumber}' (previous max: {$maxSeq})\n";

        // ── 4. Resolve / Create Cost Center for Aragonda Vikas Trust ──────────
        $avtCostCenter = DB::table('cost_centers')
            ->where('tenant_id', $avtTenantId)
            ->where('is_active', true)
            ->first();

        if (!$avtCostCenter) {
            $avtCostCenter = DB::table('cost_centers')->where('tenant_id', $avtTenantId)->first();
        }

        if (!$avtCostCenter) {
            $ccId = DB::table('cost_centers')->insertGetId([
                'tenant_id'           => $avtTenantId,
                'name'                => 'General / Administration',
                'code'                => 'AVT-GEN',
                'annual_budget'       => 0,
                'current_fiscal_year' => '2026-2027',
                'is_active'           => true,
                'created_at'          => now(),
                'updated_at'          => now(),
            ]);
            $avtCostCenter = DB::table('cost_centers')->where('id', $ccId)->first();
            echo "Created default Cost Center for AVT: ID {$ccId}\n";
        } else {
            echo "Using AVT Cost Center: ID {$avtCostCenter->id}, Name '{$avtCostCenter->name}'\n";
        }

        // ── 5. Resolve / Create Location for Aragonda Vikas Trust ─────────────
        $avtLocation = DB::table('locations')
            ->where('tenant_id', $avtTenantId)
            ->first();

        if (!$avtLocation) {
            $locId = DB::table('locations')->insertGetId([
                'tenant_id'   => $avtTenantId,
                'name'        => 'Aragonda Vikas Trust',
                'address'     => 'Aragonda Village & Post, Thavanampalle Mandal',
                'city'        => 'Chittoor District',
                'state'       => 'Andhra Pradesh',
                'state_code'  => '37',
                'pincode'     => '517129',
                'country'     => 'India',
                'is_active'   => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
            $avtLocation = DB::table('locations')->where('id', $locId)->first();
            echo "Created Location for AVT: ID {$locId}\n";
        } else {
            echo "Using AVT Location: ID {$avtLocation->id}, Name '{$avtLocation->name}'\n";
        }

        // ── 6. Map / Copy Vendor to Aragonda Vikas Trust ──────────────────────
        $targetVendorId = $targetPo->vendor_id;
        $targetVendorAddressId = $targetPo->vendor_address_id;

        if ($targetPo->vendor_id) {
            $origVendor = DB::table('vendors')->where('id', $targetPo->vendor_id)->first();
            if ($origVendor && $origVendor->tenant_id != $avtTenantId) {
                // Check if vendor already exists in AVT
                $avtVendor = DB::table('vendors')
                    ->where('tenant_id', $avtTenantId)
                    ->where(function ($q) use ($origVendor) {
                        $q->where('name', $origVendor->name);
                        if (!empty($origVendor->gstin)) {
                            $q->orWhere('gstin', $origVendor->gstin);
                        }
                    })
                    ->first();

                if (!$avtVendor) {
                    $vendorData = (array) $origVendor;
                    unset($vendorData['id']);
                    $vendorData['tenant_id'] = $avtTenantId;
                    $vendorData['created_at'] = now();
                    $vendorData['updated_at'] = now();
                    $targetVendorId = DB::table('vendors')->insertGetId($vendorData);
                    echo "Copied vendor '{$origVendor->name}' to AVT: New ID {$targetVendorId}\n";

                    // Copy vendor addresses
                    $origAddresses = DB::table('vendor_addresses')->where('vendor_id', $origVendor->id)->get();
                    foreach ($origAddresses as $addr) {
                        $addrData = (array) $addr;
                        unset($addrData['id']);
                        $addrData['vendor_id'] = $targetVendorId;
                        $newAddrId = DB::table('vendor_addresses')->insertGetId($addrData);
                        if ($addr->id == $targetPo->vendor_address_id) {
                            $targetVendorAddressId = $newAddrId;
                        }
                    }
                } else {
                    $targetVendorId = $avtVendor->id;
                    $avtVendorAddr = DB::table('vendor_addresses')->where('vendor_id', $avtVendor->id)->first();
                    if ($avtVendorAddr) {
                        $targetVendorAddressId = $avtVendorAddr->id;
                    }
                    echo "Matched existing AVT vendor: ID {$targetVendorId}\n";
                }
            }
        }

        // ── 7. Update Purchase Order ──────────────────────────────────────────
        $poUpdateData = [
            'tenant_id'         => $avtTenantId,
            'po_number'         => $newPoNumber,
            'cost_center_id'    => $avtCostCenter->id,
            'vendor_id'         => $targetVendorId,
            'vendor_address_id' => $targetVendorAddressId,
            'updated_at'        => now(),
        ];

        if ($avtLocation) {
            $poUpdateData['bill_to_location_id'] = $avtLocation->id;
            // Only update ship_to if empty or pointed to old tenant location
            $poUpdateData['ship_to_location_id'] = $targetPo->ship_to_location_id ?: $avtLocation->id;
        }

        DB::table('purchase_orders')->where('id', $poId)->update($poUpdateData);
        echo "Successfully updated PO #{$poId} to Aragonda Vikas Trust with PO No: '{$newPoNumber}'\n";

        // ── 8. Map Line Items & Products ──────────────────────────────────────
        $poItems = DB::table('po_items')->where('po_id', $poId)->get();
        foreach ($poItems as $item) {
            $itemUpdate = [];

            if ($item->product_id) {
                $oldProd = DB::table('products')->where('id', $item->product_id)->first();
                if ($oldProd && $oldProd->tenant_id != $avtTenantId) {
                    // Check if product exists in AVT
                    $avtProd = DB::table('products')
                        ->where('tenant_id', $avtTenantId)
                        ->where(function ($q) use ($oldProd) {
                            $q->where('name', $oldProd->name)
                              ->orWhere('code', $oldProd->code);
                        })
                        ->first();

                    if (!$avtProd) {
                        $pData = (array) $oldProd;
                        unset($pData['id']);
                        $pData['tenant_id'] = $avtTenantId;
                        $pData['created_at'] = now();
                        $pData['updated_at'] = now();
                        $newProdId = DB::table('products')->insertGetId($pData);
                        $itemUpdate['product_id'] = $newProdId;
                    } else {
                        $itemUpdate['product_id'] = $avtProd->id;
                    }
                }
            }

            if (!empty($itemUpdate)) {
                $itemUpdate['updated_at'] = now();
                DB::table('po_items')->where('id', $item->id)->update($itemUpdate);
            }
        }
        echo "Processed " . $poItems->count() . " PO line item(s).\n";

        // ── 9. Move Linked PR (if present) ────────────────────────────────────
        if ($targetPo->pr_id) {
            $pr = DB::table('purchase_requisitions')->where('id', $targetPo->pr_id)->first();
            if ($pr && $pr->tenant_id != $avtTenantId) {
                DB::table('purchase_requisitions')->where('id', $pr->id)->update([
                    'tenant_id'      => $avtTenantId,
                    'cost_center_id' => $avtCostCenter->id,
                    'location_id'    => $avtLocation?->id ?? $pr->location_id,
                    'updated_at'     => now(),
                ]);
                echo "Moved linked PR #{$pr->id} ({$pr->pr_number}) to Aragonda Vikas Trust.\n";
            }
        }

        // ── 10. Update Approvals ──────────────────────────────────────────────
        $avtApprover = DB::table('user_tenant_roles')
            ->where('tenant_id', $avtTenantId)
            ->whereIn('role', ['client_approver', 'client_admin', 'approver', 'admin'])
            ->where('is_active', true)
            ->first();

        if ($avtApprover) {
            DB::table('approvals')
                ->where('entity_type', 'PO')
                ->where('entity_id', $poId)
                ->where('action', 'pending')
                ->update([
                    'assigned_to_user_id' => $avtApprover->user_id,
                    'updated_at'          => now(),
                ]);
            echo "Updated pending approvals for PO #{$poId} to AVT approver ID {$avtApprover->user_id}.\n";
        }

        // ── 11. Update Budget Ledger ──────────────────────────────────────────
        if (Schema::hasTable('budget_ledger')) {
            DB::table('budget_ledger')
                ->where('reference_type', 'PO')
                ->where('reference_id', $poId)
                ->update([
                    'cost_center_id' => $avtCostCenter->id,
                    'updated_at'     => now(),
                ]);
        }

        // ── 12. Record Activity Log ───────────────────────────────────────────
        if (Schema::hasTable('activity_logs')) {
            DB::table('activity_logs')->insert([
                'tenant_id'   => $avtTenantId,
                'entity_type' => 'PO',
                'entity_id'   => $poId,
                'user_id'     => $targetPo->created_by ?: 1,
                'action'      => 'organization_changed',
                'meta'        => json_encode([
                    'po_id'         => $poId,
                    'old_po_number' => $oldPoNumber,
                    'new_po_number' => $newPoNumber,
                    'old_tenant_id' => $targetPo->tenant_id,
                    'new_tenant_id' => $avtTenantId,
                    'organization'  => 'Aragonda Vikas Trust',
                ]),
                'created_at'  => now(),
            ]);
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
