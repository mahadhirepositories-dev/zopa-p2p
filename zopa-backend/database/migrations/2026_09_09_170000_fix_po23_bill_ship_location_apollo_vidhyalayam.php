<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Set Bill To and Ship To location to Apollo Vidhyalayam for PO AV/2026-27/23 (PO #129).
     *
     * 1. Ensure a Location exists for Tenant 7 (Apollo Vidhyalayam) named 'Apollo Vidhyalayam'.
     *    - Populate address, city, state, pincode, gstin from Tenant 7 or clone from previous location.
     * 2. If any location belonging to Tenant 7 is titled 'Apollo Isha Vidhya Niketan', update it to 'Apollo Vidhyalayam'.
     * 3. Update PO #129 (AV/2026-27/23):
     *    - tenant_id = 7
     *    - bill_to_location_id = Apollo Vidhyalayam location id
     *    - ship_to_location_id = Apollo Vidhyalayam location id
     * 4. Update linked PR #96 (PR17) to tenant_id = 7 and location_id = Apollo Vidhyalayam location id.
     * 5. Link the location to Apollo Vidhyalayam default cost center.
     */
    public function up(): void
    {
        // 1. Resolve Apollo Vidhyalayam tenant
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

        $tenantId = $avTenant->id;

        // Parse tenant address if available
        $tenantAddressJson = !empty($avTenant->address_json)
            ? (is_string($avTenant->address_json) ? json_decode($avTenant->address_json, true) : (array)$avTenant->address_json)
            : [];

        // Check if there is already a location for Tenant 7
        $avLocation = DB::table('locations')->where('tenant_id', $tenantId)->first();

        // Also check if there was a location copied or previously used with ID 11
        $sourceLoc = DB::table('locations')->where('id', 11)->first();

        if (!$avLocation) {
            // Create a new location for Apollo Vidhyalayam
            $locData = [
                'tenant_id'  => $tenantId,
                'name'       => 'Apollo Vidhyalayam',
                'address'    => $tenantAddressJson['address'] ?? $sourceLoc?->address ?? '',
                'city'       => $tenantAddressJson['city'] ?? $sourceLoc?->city ?? 'Chennai',
                'state'      => $tenantAddressJson['state'] ?? $sourceLoc?->state ?? 'Tamil Nadu',
                'state_code' => $tenantAddressJson['state_code'] ?? $sourceLoc?->state_code ?? '33',
                'pincode'    => $tenantAddressJson['pincode'] ?? $sourceLoc?->pincode ?? '',
                'country'    => $tenantAddressJson['country'] ?? $sourceLoc?->country ?? 'India',
                'gstin'      => $avTenant->gstin ?? $sourceLoc?->gstin ?? '',
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('locations', 'receiver_name')) {
                $locData['receiver_name'] = $sourceLoc?->receiver_name ?? null;
            }
            if (Schema::hasColumn('locations', 'receiver_phone')) {
                $locData['receiver_phone'] = $sourceLoc?->receiver_phone ?? null;
            }

            $locId = DB::table('locations')->insertGetId($locData);
            $avLocation = DB::table('locations')->where('id', $locId)->first();
        } else {
            // Location exists for tenant 7; ensure its name is 'Apollo Vidhyalayam'
            DB::table('locations')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) {
                    $q->where('name', 'LIKE', '%Apollo%Isha%')
                      ->orWhere('name', 'LIKE', '%Niketan%');
                })
                ->update([
                    'name'       => 'Apollo Vidhyalayam',
                    'updated_at' => now(),
                ]);

            $avLocation = DB::table('locations')->where('tenant_id', $tenantId)->first();
            if ($avLocation && (str_contains($avLocation->name, 'Isha') || str_contains($avLocation->name, 'Niketan'))) {
                DB::table('locations')->where('id', $avLocation->id)->update([
                    'name'       => 'Apollo Vidhyalayam',
                    'updated_at' => now(),
                ]);
            }
        }

        $targetLocationId = $avLocation->id;

        // 2. Update PO AV/2026-27/23 (ID 129 or matching po_number)
        DB::table('purchase_orders')
            ->where(function ($q) {
                $q->where('id', 129)
                  ->orWhere('po_number', 'AV/2026-27/23')
                  ->orWhere('po_number', 'LIKE', '%2026-27/23%');
            })
            ->update([
                'tenant_id'           => $tenantId,
                'bill_to_location_id' => $targetLocationId,
                'ship_to_location_id' => $targetLocationId,
                'updated_at'          => now(),
            ]);

        // 3. Update linked PR 96 (PR17) if exists
        $pr = DB::table('purchase_requisitions')
            ->where(function ($q) {
                $q->where('id', 96)
                  ->orWhere('pr_number', 'PR17')
                  ->orWhere('title', 'LIKE', '%AV-HIIGINBOTHAMS%');
            })
            ->first();

        if ($pr) {
            DB::table('purchase_requisitions')
                ->where('id', $pr->id)
                ->update([
                    'tenant_id'   => $tenantId,
                    'location_id' => $targetLocationId,
                    'updated_at'  => now(),
                ]);
        }

        // 4. Update Cost Center for Apollo Vidhyalayam
        $costCenter = DB::table('cost_centers')
            ->where('tenant_id', $tenantId)
            ->first();

        if ($costCenter) {
            DB::table('cost_centers')
                ->where('id', $costCenter->id)
                ->update([
                    'location_id' => $targetLocationId,
                    'updated_at'  => now(),
                ]);

            if (Schema::hasTable('cost_center_location')) {
                DB::table('cost_center_location')->updateOrInsert(
                    ['cost_center_id' => $costCenter->id, 'location_id' => $targetLocationId],
                    ['created_at' => now(), 'updated_at' => now()]
                );
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
