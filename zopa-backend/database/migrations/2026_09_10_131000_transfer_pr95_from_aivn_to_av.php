<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Transfer PR #95 from Apollo Isha Vidhya Niketan (AIVN) to Apollo Vidhyalayam (AV).
     *
     * 1. Resolve Tenants:
     *    - AIVN (Tenant ID: 4)
     *    - AV (Tenant ID: 7)
     *
     * 2. Resolve Apollo Vidhyalayam:
     *    - Location ID (Apollo Vidhyalayam)
     *    - Cost Center ID (Apollo Vidhyalayam)
     *
     * 3. Update PR #95:
     *    - Set tenant_id = 7
     *    - Set cost_center_id = Apollo Vidhyalayam cost center
     *    - Set location_id = Apollo Vidhyalayam location
     *
     * 4. Update PR line items:
     *    - Map product_id to Apollo Vidhyalayam's product if it belongs to AIVN
     *
     * 5. Transfer any linked Purchase Orders (or po_prs entries):
     *    - If any PO is linked to PR 95 and belongs to AIVN, update to AV as well
     *
     * 6. Update PR approval records if any exist
     */
    public function up(): void
    {
        // ── 1. Resolve Apollo Vidhyalayam Tenant ───────────────────────────────
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

        // ── 2. Resolve Location & Cost Center for Apollo Vidhyalayam ──────────
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

        // ── 3. Find PR #95 ────────────────────────────────────────────────────
        $pr95 = DB::table('purchase_requisitions')
            ->where('id', 95)
            ->orWhere(function ($q) {
                $q->where('pr_number', 'PR95')
                  ->orWhere('pr_number', 'PR-95')
                  ->orWhere('pr_ref', 'PR95');
            })
            ->first();

        if (!$pr95) {
            return;
        }

        $prId = $pr95->id;

        $prUpdateData = [
            'tenant_id'  => $avTenantId,
            'updated_at' => now(),
        ];

        if ($avCostCenter) {
            $prUpdateData['cost_center_id'] = $avCostCenter->id;
        }
        if ($avLocation) {
            $prUpdateData['location_id'] = $avLocation->id;
        }

        DB::table('purchase_requisitions')->where('id', $prId)->update($prUpdateData);

        // ── 4. Update PR Line Items Product IDs ───────────────────────────────
        $prItems = DB::table('pr_items')->where('pr_id', $prId)->get();
        foreach ($prItems as $pi) {
            if ($pi->product_id) {
                $origP = DB::table('products')->where('id', $pi->product_id)->first();
                if ($origP && $origP->tenant_id != $avTenantId) {
                    $avP = DB::table('products')
                        ->where('tenant_id', $avTenantId)
                        ->where(function ($q) use ($origP) {
                            $q->where('name', $origP->name);
                            if ($origP->code) {
                                $avCode = str_starts_with($origP->code, 'AIVN')
                                    ? 'AV' . substr($origP->code, 4)
                                    : (str_starts_with($origP->code, 'AIV') ? 'AV' . substr($origP->code, 3) : $origP->code);
                                $q->orWhere('code', $avCode);
                            }
                        })
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

        // ── 5. Update Approvals for PR #95 ────────────────────────────────────
        if ($avCostCenter) {
            $avPrApprovalConfig = DB::table('approval_configs')
                ->where('cost_center_id', $avCostCenter->id)
                ->where('type', 'pr')
                ->where('level', 1)
                ->where('is_active', true)
                ->first();

            $targetApproverId = null;
            if ($avPrApprovalConfig) {
                if (!empty($avPrApprovalConfig->user_ids)) {
                    $ids = is_string($avPrApprovalConfig->user_ids) ? json_decode($avPrApprovalConfig->user_ids, true) : $avPrApprovalConfig->user_ids;
                    $targetApproverId = $ids[0] ?? $avPrApprovalConfig->user_id;
                } else {
                    $targetApproverId = $avPrApprovalConfig->user_id;
                }
            }

            if (!$targetApproverId) {
                $approverRole = DB::table('user_tenant_roles')
                    ->where('tenant_id', $avTenantId)
                    ->whereIn('role', ['client_approver', 'client_admin', 'approver', 'admin'])
                    ->where('is_active', true)
                    ->first();
                $targetApproverId = $approverRole?->user_id;
            }

            if ($targetApproverId) {
                DB::table('approvals')
                    ->where('entity_type', 'PR')
                    ->where('entity_id', $prId)
                    ->where('action', 'pending')
                    ->update([
                        'assigned_to_user_id' => $targetApproverId,
                        'updated_at'          => now(),
                    ]);
            }
        }

        // ── 6. Transfer any Linked POs for PR #95 if they exist and are in AIVN ─
        $linkedPoIds = DB::table('purchase_orders')->where('pr_id', $prId)->pluck('id')->toArray();
        if (Schema::hasTable('po_prs')) {
            $pivotPoIds = DB::table('po_prs')->where('pr_id', $prId)->pluck('po_id')->toArray();
            $linkedPoIds = array_unique(array_merge($linkedPoIds, $pivotPoIds));
        }

        foreach ($linkedPoIds as $poId) {
            $po = DB::table('purchase_orders')->where('id', $poId)->first();
            if ($po && $po->tenant_id != $avTenantId) {
                $poUpdate = [
                    'tenant_id' => $avTenantId,
                    'updated_at' => now(),
                ];
                if ($avCostCenter) {
                    $poUpdate['cost_center_id'] = $avCostCenter->id;
                }
                if ($avLocation) {
                    $poUpdate['bill_to_location_id'] = $avLocation->id;
                    $poUpdate['ship_to_location_id'] = $avLocation->id;
                }
                DB::table('purchase_orders')->where('id', $poId)->update($poUpdate);
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
