<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Copy vendor 'infycare' from Total Health to Apollo Vidhyalayam.
     * Assign the next vendor code from the list in Apollo Vidhyalayam.
     */
    public function up(): void
    {
        try {
            // ── 1. Resolve Tenants: Total Health & Apollo Vidhyalayam ──────────
            $thTenant = DB::table('tenants')
                ->where('id', 2)
                ->orWhere('name', 'LIKE', '%Total Health%')
                ->orWhere('code', 'TH')
                ->first();
            $thTenantId = $thTenant?->id ?? 2;

            $avTenant = DB::table('tenants')
                ->where('id', 7)
                ->orWhere('name', 'LIKE', '%Apollo%Vidhyalayam%')
                ->orWhere('name', 'LIKE', '%Vidhyalayam%')
                ->orWhere('code', 'APOLLOVIDHYALAYAM')
                ->first();
            $avTenantId = $avTenant?->id ?? 7;

            echo "Tenants: Total Health (ID {$thTenantId}), Apollo Vidhyalayam (ID {$avTenantId})\n";

            // ── 2. Find Source Vendor 'infycare' ─────────────────────────────────
            $sourceVendor = DB::table('vendors')
                ->where(function ($q) use ($thTenantId) {
                    $q->where('tenant_id', $thTenantId)
                      ->where(function ($sub) {
                          $sub->where('name', 'LIKE', '%infycare%')
                              ->orWhere('name', 'LIKE', '%infy%care%')
                              ->orWhere('name', 'LIKE', '%inficare%');
                      });
                })
                ->first();

            // Fallback: search across all tenants if not specifically tied to TH tenant_id
            if (!$sourceVendor) {
                $sourceVendor = DB::table('vendors')
                    ->where('name', 'LIKE', '%infycare%')
                    ->orWhere('name', 'LIKE', '%infy%care%')
                    ->orWhere('name', 'LIKE', '%inficare%')
                    ->first();
            }

            if (!$sourceVendor) {
                echo "Warning: No vendor found matching 'infycare'.\n";
                return;
            }

            echo "Found source vendor: ID {$sourceVendor->id}, Name '{$sourceVendor->name}', Tenant {$sourceVendor->tenant_id}\n";

            // ── 3. Check if already exists in Apollo Vidhyalayam ────────────────
            $existingAvVendor = DB::table('vendors')
                ->where('tenant_id', $avTenantId)
                ->where(function ($q) use ($sourceVendor) {
                    $q->where('name', 'LIKE', '%' . trim($sourceVendor->name) . '%')
                      ->orWhere('name', 'LIKE', '%infycare%')
                      ->orWhere('name', 'LIKE', '%infy%care%');
                })
                ->first();

            // ── 4. Map Category & Subcategory to AV ─────────────────────────────
            $targetCatId = null;
            if (!empty($sourceVendor->category_id)) {
                $origCat = DB::table('categories')->where('id', $sourceVendor->category_id)->first();
                if ($origCat) {
                    $avCat = DB::table('categories')
                        ->where('tenant_id', $avTenantId)
                        ->where('name', $origCat->name)
                        ->first();
                    if (!$avCat) {
                        $targetCatId = DB::table('categories')->insertGetId([
                            'tenant_id'  => $avTenantId,
                            'name'       => $origCat->name,
                            'code'       => $origCat->code ?? null,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    } else {
                        $targetCatId = $avCat->id;
                    }
                }
            }

            $targetSubcatId = null;
            if (!empty($sourceVendor->subcategory_id)) {
                $origSubcat = DB::table('categories')->where('id', $sourceVendor->subcategory_id)->first();
                if ($origSubcat) {
                    $avSubcat = DB::table('categories')
                        ->where('tenant_id', $avTenantId)
                        ->where('name', $origSubcat->name)
                        ->first();
                    if (!$avSubcat) {
                        $targetSubcatId = DB::table('categories')->insertGetId([
                            'tenant_id'  => $avTenantId,
                            'parent_id'  => $targetCatId,
                            'name'       => $origSubcat->name,
                            'code'       => $origSubcat->code ?? null,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    } else {
                        $targetSubcatId = $avSubcat->id;
                    }
                }
            }

            if ($existingAvVendor) {
                // Already in AV — ensure active and update missing details
                DB::table('vendors')->where('id', $existingAvVendor->id)->update([
                    'is_active'       => true,
                    'category_id'     => $targetCatId ?? $existingAvVendor->category_id,
                    'subcategory_id'  => $targetSubcatId ?? $existingAvVendor->subcategory_id,
                    'pan'             => $existingAvVendor->pan ?: $sourceVendor->pan,
                    'gstin'           => $existingAvVendor->gstin ?: $sourceVendor->gstin,
                    'email'           => $existingAvVendor->email ?: $sourceVendor->email,
                    'phone'           => $existingAvVendor->phone ?: $sourceVendor->phone,
                    'account_no'      => $existingAvVendor->account_no ?: $sourceVendor->account_no,
                    'ifsc'            => $existingAvVendor->ifsc ?: $sourceVendor->ifsc,
                    'bank_name'       => $existingAvVendor->bank_name ?: $sourceVendor->bank_name,
                    'branch_name'     => $existingAvVendor->branch_name ?: $sourceVendor->branch_name,
                    'updated_at'      => now(),
                ]);
                $targetAvVendorId = $existingAvVendor->id;
                echo "Vendor already exists in Apollo Vidhyalayam as ID {$targetAvVendorId} ({$existingAvVendor->global_vendor_code}). Updated.\n";
            } else {
                // ── 5. Generate Next Vendor Code in Apollo Vidhyalayam ──────────
                $existingCodes = DB::table('vendors')
                    ->where('tenant_id', $avTenantId)
                    ->whereNotNull('global_vendor_code')
                    ->where('global_vendor_code', '!=', '')
                    ->orderBy('id')
                    ->pluck('global_vendor_code')
                    ->toArray();

                $nextCode = null;
                $defaultPrefix = 'ZP-' . date('y') . date('m') . '-';

                if (!empty($existingCodes)) {
                    $latestCode = end($existingCodes);

                    // If existing codes end with digits (e.g. ZP-2609-02, V-005, VEN-12, 104)
                    if (preg_match('/^(.*?)(\d+)$/', $latestCode, $m)) {
                        $prefix = $m[1];
                        $digits = $m[2];
                        $len = strlen($digits);

                        $maxNum = 0;
                        foreach ($existingCodes as $c) {
                            if (str_starts_with($c, $prefix) && preg_match('/^' . preg_quote($prefix, '/') . '(\d+)$/', $c, $subM)) {
                                $val = (int)$subM[1];
                                if ($val > $maxNum) {
                                    $maxNum = $val;
                                }
                            }
                        }
                        $candidateSeq = $maxNum + 1;
                        do {
                            $nextCode = $prefix . str_pad($candidateSeq, $len, '0', STR_PAD_LEFT);
                            $candidateSeq++;
                        } while (DB::table('vendors')->where('tenant_id', $avTenantId)->where('global_vendor_code', $nextCode)->exists());
                    }
                }

                if (empty($nextCode)) {
                    $candidateSeq = 1;
                    do {
                        $nextCode = $defaultPrefix . str_pad($candidateSeq, 2, '0', STR_PAD_LEFT);
                        $candidateSeq++;
                    } while (DB::table('vendors')->where('tenant_id', $avTenantId)->where('global_vendor_code', $nextCode)->exists());
                }

                echo "Generated Next Vendor Code for AV: {$nextCode}\n";

                // Generate entity_code if existing AV vendors have entity_code
                $nextEntityCode = null;
                $existingEntityCodes = DB::table('vendors')
                    ->where('tenant_id', $avTenantId)
                    ->whereNotNull('entity_code')
                    ->where('entity_code', '!=', '')
                    ->orderBy('id')
                    ->pluck('entity_code')
                    ->toArray();

                if (!empty($existingEntityCodes)) {
                    $latestEntityCode = end($existingEntityCodes);
                    if (preg_match('/^(.*?)(\d+)$/', $latestEntityCode, $em)) {
                        $ePrefix = $em[1];
                        $eDigits = $em[2];
                        $eLen = strlen($eDigits);
                        $eMax = 0;
                        foreach ($existingEntityCodes as $ec) {
                            if (str_starts_with($ec, $ePrefix) && preg_match('/^' . preg_quote($ePrefix, '/') . '(\d+)$/', $ec, $subEM)) {
                                $v = (int)$subEM[1];
                                if ($v > $eMax) $eMax = $v;
                            }
                        }
                        $nextEntityCode = $ePrefix . str_pad($eMax + 1, $eLen, '0', STR_PAD_LEFT);
                    }
                }

                // ── 6. Create Vendor Clone in Apollo Vidhyalayam ────────────────
                $vendorData = (array) $sourceVendor;
                unset($vendorData['id']);
                $vendorData['tenant_id']          = $avTenantId;
                $vendorData['global_vendor_code'] = $nextCode;
                if ($nextEntityCode) {
                    $vendorData['entity_code']    = $nextEntityCode;
                }
                $vendorData['category_id']        = $targetCatId;
                $vendorData['subcategory_id']     = $targetSubcatId;
                $vendorData['is_active']          = true;
                $vendorData['created_at']         = now();
                $vendorData['updated_at']         = now();

                $targetAvVendorId = DB::table('vendors')->insertGetId($vendorData);
                echo "Created vendor in Apollo Vidhyalayam: ID {$targetAvVendorId}, Code {$nextCode}\n";
            }

            // ── 7. Copy Vendor Addresses ────────────────────────────────────────
            $origAddresses = DB::table('vendor_addresses')->where('vendor_id', $sourceVendor->id)->get();
            $existingAvAddrs = DB::table('vendor_addresses')->where('vendor_id', $targetAvVendorId)->get();

            if ($existingAvAddrs->isEmpty() && $origAddresses->isNotEmpty()) {
                foreach ($origAddresses as $addr) {
                    $addrData = (array) $addr;
                    unset($addrData['id']);
                    $addrData['vendor_id']  = $targetAvVendorId;
                    $addrData['created_at'] = now();
                    $addrData['updated_at'] = now();
                    DB::table('vendor_addresses')->insert($addrData);
                }
                echo "Copied " . $origAddresses->count() . " address(es) to AV vendor ID {$targetAvVendorId}.\n";
            }

            // ── 8. Copy Vendor Categories ───────────────────────────────────────
            if (Schema::hasTable('vendor_categories')) {
                $origCats = DB::table('vendor_categories')->where('vendor_id', $sourceVendor->id)->get();
                $existingAvCats = DB::table('vendor_categories')->where('vendor_id', $targetAvVendorId)->get();
                if ($existingAvCats->isEmpty() && $origCats->isNotEmpty()) {
                    foreach ($origCats as $vc) {
                        $vcData = (array) $vc;
                        unset($vcData['id']);
                        $vcData['vendor_id']  = $targetAvVendorId;
                        $vcData['created_at'] = now();
                        $vcData['updated_at'] = now();
                        DB::table('vendor_categories')->insert($vcData);
                    }
                    echo "Copied " . $origCats->count() . " vendor category record(s).\n";
                }
            }

            // ── 9. Copy Vendor Documents ────────────────────────────────────────
            if (Schema::hasTable('vendor_documents')) {
                $origDocs = DB::table('vendor_documents')->where('vendor_id', $sourceVendor->id)->get();
                $existingAvDocs = DB::table('vendor_documents')->where('vendor_id', $targetAvVendorId)->get();
                if ($existingAvDocs->isEmpty() && $origDocs->isNotEmpty()) {
                    foreach ($origDocs as $vd) {
                        $vdData = (array) $vd;
                        unset($vdData['id']);
                        $vdData['vendor_id']  = $targetAvVendorId;
                        $vdData['created_at'] = now();
                        $vdData['updated_at'] = now();
                        DB::table('vendor_documents')->insert($vdData);
                    }
                    echo "Copied " . $origDocs->count() . " document(s).\n";
                }
            }

            // ── 10. Audit Activity Log ──────────────────────────────────────────
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $avTenantId,
                    'entity_type' => 'VENDOR',
                    'entity_id'   => $targetAvVendorId,
                    'user_id'     => 1,
                    'action'      => 'created',
                    'meta'        => json_encode([
                        'name'               => $sourceVendor->name,
                        'source_tenant'      => 'Total Health',
                        'target_tenant'      => 'Apollo Vidhyalayam',
                        'global_vendor_code' => $nextCode ?? ($existingAvVendor?->global_vendor_code ?? null),
                        'source_vendor_id'   => $sourceVendor->id,
                    ]),
                    'created_at'  => now(),
                ]);
            }

            Cache::flush();
            echo "Successfully completed vendor copying to Apollo Vidhyalayam.\n";
        } catch (\Throwable $e) {
            echo "Migration Notice: " . $e->getMessage() . "\n";
        }
    }

    public function down(): void
    {
    }
};
