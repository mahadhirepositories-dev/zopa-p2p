<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * Fix and submit PO #131 for Apollo Vidhyalayam:
     * 1. Ensure Tenant 7 (Apollo Vidhyalayam) is properly configured with po_prefix and product_prefix.
     * 2. Ensure Apollo Vidhyalayam has a designated Location and Cost Center with ample budget (₹5,000,000).
     * 3. Sync User Roles and Approval Configs from Apollo Isha Vidhya Niketan (Tenant 4) to Apollo Vidhyalayam (Tenant 7).
     * 4. Update PO #131:
     *    - Map tenant_id = 7
     *    - Map cost_center_id to Apollo Vidhyalayam cost center
     *    - Map locations to Apollo Vidhyalayam location
     *    - Assign sequential PO Number: AV/2026-27/25
     *    - Set status = 'pending_l1'
     *    - Insert pending Approval record assigned to Level 1 approver
     *    - Insert freeze record into budget_ledger
     *    - Insert submission entry into activity_logs
     */
    public function up(): void
    {
        // ── 1. Resolve Apollo Vidhyalayam & AIVN Tenants ──────────────────────
        $avTenant = DB::table('tenants')
            ->where('id', 7)
            ->orWhere(function ($q) {
                $q->where('name', 'LIKE', '%Apollo%Vidhyalayam%')
                  ->orWhere('code', 'LIKE', '%APOLLOVIDHYALAYAM%');
            })
            ->first();

        if (!$avTenant) {
            $avTenant = DB::table('tenants')->where('name', 'LIKE', '%Vidhyalayam%')->first();
        }

        if (!$avTenant) {
            return;
        }

        $avTenantId = $avTenant->id;

        // Ensure po_prefix and product_prefix on AV tenant
        DB::table('tenants')->where('id', $avTenantId)->update([
            'po_prefix'      => 'AV/2026-27/',
            'product_prefix' => 'AV',
            'updated_at'     => now(),
        ]);

        $aivnTenant = DB::table('tenants')
            ->where('id', 4)
            ->orWhere('name', 'LIKE', '%Apollo%Isha%')
            ->orWhere('name', 'LIKE', '%Niketan%')
            ->first();

        $aivnTenantId = $aivnTenant?->id;

        // ── 2. Resolve / Create Location for Apollo Vidhyalayam ──────────────
        $avLocation = DB::table('locations')
            ->where('tenant_id', $avTenantId)
            ->where('name', 'LIKE', '%Apollo%Vidhyalayam%')
            ->first();

        if (!$avLocation) {
            $avLocation = DB::table('locations')->where('tenant_id', $avTenantId)->first();
        }

        if (!$avLocation) {
            $locId = DB::table('locations')->insertGetId([
                'tenant_id'  => $avTenantId,
                'name'       => 'Apollo Vidhyalayam',
                'address'    => 'Apollo Vidhyalayam',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $avLocation = DB::table('locations')->where('id', $locId)->first();
        }

        // ── 3. Resolve / Create / Fund Cost Center for Apollo Vidhyalayam ──────
        $avCostCenter = DB::table('cost_centers')
            ->where('tenant_id', $avTenantId)
            ->where('is_active', true)
            ->first();

        if (!$avCostCenter) {
            $avCostCenter = DB::table('cost_centers')->where('tenant_id', $avTenantId)->first();
        }

        if (!$avCostCenter) {
            $ccId = DB::table('cost_centers')->insertGetId([
                'tenant_id'           => $avTenantId,
                'name'                => 'Apollo Vidhyalayam',
                'annual_budget'       => 5000000.00,
                'budget_from'         => '2026-04-01',
                'budget_to'           => '2027-03-31',
                'current_fiscal_year' => '2026-2027',
                'location_id'         => $avLocation?->id,
                'is_active'           => true,
                'created_at'          => now(),
                'updated_at'          => now(),
            ]);
            $avCostCenter = DB::table('cost_centers')->where('id', $ccId)->first();
        } else {
            DB::table('cost_centers')->where('id', $avCostCenter->id)->update([
                'name'                => $avCostCenter->name ?: 'Apollo Vidhyalayam',
                'annual_budget'       => max((float)$avCostCenter->annual_budget, 5000000.00),
                'budget_from'         => $avCostCenter->budget_from ?: '2026-04-01',
                'budget_to'           => $avCostCenter->budget_to ?: '2027-03-31',
                'current_fiscal_year' => $avCostCenter->current_fiscal_year ?: '2026-2027',
                'location_id'         => $avCostCenter->location_id ?: $avLocation?->id,
                'is_active'           => true,
                'updated_at'          => now(),
            ]);
            $avCostCenter = DB::table('cost_centers')->where('id', $avCostCenter->id)->first();
        }

        if ($avLocation && Schema::hasTable('cost_center_location')) {
            DB::table('cost_center_location')->updateOrInsert(
                ['cost_center_id' => $avCostCenter->id, 'location_id' => $avLocation->id],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }

        // ── 4. Sync User Roles from Tenant 4 (AIVN) to Tenant 7 (AV) ──────────
        if ($aivnTenantId) {
            $aivnRoles = DB::table('user_tenant_roles')
                ->where('tenant_id', $aivnTenantId)
                ->where('is_active', true)
                ->get();

            foreach ($aivnRoles as $roleRow) {
                $exists = DB::table('user_tenant_roles')
                    ->where('tenant_id', $avTenantId)
                    ->where('user_id', $roleRow->user_id)
                    ->where('role', $roleRow->role)
                    ->exists();

                if (!$exists) {
                    DB::table('user_tenant_roles')->insert([
                        'user_id'    => $roleRow->user_id,
                        'tenant_id'  => $avTenantId,
                        'role'       => $roleRow->role,
                        'is_active'  => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        // ── 5. Sync Approval Configs from AIVN to AV ───────────────────────────
        $targetApproverId = null;
        if ($aivnTenantId) {
            $aivnCostCenters = DB::table('cost_centers')->where('tenant_id', $aivnTenantId)->pluck('id');
            $aivnConfigs = DB::table('approval_configs')
                ->whereIn('cost_center_id', $aivnCostCenters)
                ->where('is_active', true)
                ->get();

            foreach ($aivnConfigs as $cfg) {
                $exists = DB::table('approval_configs')
                    ->where('cost_center_id', $avCostCenter->id)
                    ->where('type', $cfg->type)
                    ->where('level', $cfg->level)
                    ->exists();

                if (!$exists) {
                    DB::table('approval_configs')->insert([
                        'cost_center_id' => $avCostCenter->id,
                        'type'           => $cfg->type,
                        'level'          => $cfg->level,
                        'user_id'        => $cfg->user_id,
                        'user_ids'       => $cfg->user_ids,
                        'amount_limit'   => $cfg->amount_limit,
                        'is_active'      => true,
                        'created_at'     => now(),
                        'updated_at'     => now(),
                    ]);
                }

                if ($cfg->type === 'po' && $cfg->level == 1) {
                    if (!empty($cfg->user_ids)) {
                        $ids = is_string($cfg->user_ids) ? json_decode($cfg->user_ids, true) : $cfg->user_ids;
                        $targetApproverId = $ids[0] ?? $cfg->user_id;
                    } else {
                        $targetApproverId = $cfg->user_id;
                    }
                }
            }
        }

        // If still no target approver, query AV cost center approval configs
        if (!$targetApproverId) {
            $avPoConfig = DB::table('approval_configs')
                ->where('cost_center_id', $avCostCenter->id)
                ->where('type', 'po')
                ->where('level', 1)
                ->where('is_active', true)
                ->first();

            if ($avPoConfig) {
                if (!empty($avPoConfig->user_ids)) {
                    $ids = is_string($avPoConfig->user_ids) ? json_decode($avPoConfig->user_ids, true) : $avPoConfig->user_ids;
                    $targetApproverId = $ids[0] ?? $avPoConfig->user_id;
                } else {
                    $targetApproverId = $avPoConfig->user_id;
                }
            }
        }

        // Fallback: find any approver role for AV tenant
        if (!$targetApproverId) {
            $approverRole = DB::table('user_tenant_roles')
                ->where('tenant_id', $avTenantId)
                ->whereIn('role', ['client_approver_l1', 'client_approver', 'client_admin', 'approver', 'admin'])
                ->where('is_active', true)
                ->first();
            $targetApproverId = $approverRole?->user_id;
        }

        // Fallback 2: find any approver from AIVN tenant
        if (!$targetApproverId && $aivnTenantId) {
            $approverRole = DB::table('user_tenant_roles')
                ->where('tenant_id', $aivnTenantId)
                ->whereIn('role', ['client_approver_l1', 'client_approver', 'client_admin', 'approver', 'admin'])
                ->where('is_active', true)
                ->first();
            $targetApproverId = $approverRole?->user_id;
        }

        // Ensure an L1 PO approval config exists on AV cost center
        if ($targetApproverId) {
            $hasL1 = DB::table('approval_configs')
                ->where('cost_center_id', $avCostCenter->id)
                ->where('type', 'po')
                ->where('level', 1)
                ->exists();

            if (!$hasL1) {
                DB::table('approval_configs')->insert([
                    'cost_center_id' => $avCostCenter->id,
                    'type'           => 'po',
                    'level'          => 1,
                    'user_id'        => $targetApproverId,
                    'user_ids'       => json_encode([$targetApproverId]),
                    'amount_limit'   => null,
                    'is_active'      => true,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ]);
            }
        }

        // ── 6. Process PO #131 ────────────────────────────────────────────────
        $po131 = DB::table('purchase_orders')->where('id', 131)->first();

        if ($po131) {
            // Determine sequential PO number if draft or missing
            $poNumber = $po131->po_number;
            if (!$poNumber || str_starts_with(strtolower($poNumber), 'draft')) {
                // Find existing highest sequence for AV/2026-27/
                $existingNos = DB::table('purchase_orders')
                    ->where('tenant_id', $avTenantId)
                    ->where('po_number', 'LIKE', 'AV/2026-27/%')
                    ->pluck('po_number');

                $maxSeq = 24; // We know PO 120 is AV/2026-27/24
                foreach ($existingNos as $no) {
                    $numPart = substr($no, strlen('AV/2026-27/'));
                    if (is_numeric($numPart)) {
                        $val = (int) $numPart;
                        if ($val > $maxSeq) {
                            $maxSeq = $val;
                        }
                    }
                }
                $poNumber = 'AV/2026-27/' . ($maxSeq + 1);
            }

            $updateData = [
                'tenant_id'      => $avTenantId,
                'cost_center_id' => $avCostCenter->id,
                'po_number'      => $poNumber,
                'po_date'        => $po131->po_date ?: now()->toDateString(),
                'status'         => 'pending_l1',
                'updated_at'     => now(),
            ];

            if ($avLocation) {
                $updateData['bill_to_location_id'] = $avLocation->id;
                $updateData['ship_to_location_id'] = $avLocation->id;
            }

            DB::table('purchase_orders')->where('id', 131)->update($updateData);

            // Create or update Approval record
            if ($targetApproverId) {
                $existingApproval = DB::table('approvals')
                    ->where('entity_type', 'PO')
                    ->where('entity_id', 131)
                    ->where('level', 1)
                    ->first();

                if ($existingApproval) {
                    DB::table('approvals')->where('id', $existingApproval->id)->update([
                        'assigned_to_user_id' => $targetApproverId,
                        'action'              => 'pending',
                        'updated_at'          => now(),
                    ]);
                } else {
                    DB::table('approvals')->insert([
                        'entity_type'         => 'PO',
                        'entity_id'           => 131,
                        'level'               => 1,
                        'assigned_to_user_id' => $targetApproverId,
                        'action'              => 'pending',
                        'created_at'          => now(),
                        'updated_at'          => now(),
                    ]);
                }
            }

            // Create Budget Ledger Freeze record if not already recorded
            $hasFreeze = DB::table('budget_ledger')
                ->where('reference_type', 'PO')
                ->where('reference_id', 131)
                ->where('action', 'freeze')
                ->exists();

            if (!$hasFreeze) {
                $fiscalYear = 2026;
                $creatorId = $po131->created_by ?: ($targetApproverId ?: 1);

                DB::table('budget_ledger')->insert([
                    'cost_center_id' => $avCostCenter->id,
                    'fiscal_year'    => $fiscalYear,
                    'reference_type' => 'PO',
                    'reference_id'   => 131,
                    'freeze_amount'  => (float) $po131->grand_total,
                    'consume_amount' => 0.00,
                    'action'         => 'freeze',
                    'narration'      => 'Budget frozen for PO submission',
                    'created_by'     => $creatorId,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ]);
            }

            // Create Activity Log entry
            if (Schema::hasTable('activity_logs')) {
                DB::table('activity_logs')->insert([
                    'tenant_id'   => $avTenantId,
                    'entity_type' => 'PO',
                    'entity_id'   => 131,
                    'user_id'     => $po131->created_by ?: $targetApproverId,
                    'action'      => 'submitted',
                    'meta'        => json_encode(['po_number' => $poNumber, 'status' => 'pending_l1', 'grand_total' => $po131->grand_total]),
                    'created_at'  => now(),
                ]);
            }
        }

        Cache::flush();
    }

    public function down(): void
    {
    }
};
