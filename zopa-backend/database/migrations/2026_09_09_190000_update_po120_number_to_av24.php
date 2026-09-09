<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    /**
     * 1. Fix PO #120 po_number:
     *    - Change po_number from 'AV/2026-2723' to 'AV/2026-27/24'
     *
     * 2. Ensure Tenant 7 (Apollo Vidhyalayam) has:
     *    - po_prefix = 'AV/2026-27/'
     *    - po_starting_series = 23
     *
     * 3. Ensure Approvals for PO #120 are assigned to the configured Apollo Vidhyalayam approver.
     *
     * 4. Ensure Budget Ledger for PO #120 is recorded properly for Apollo Vidhyalayam cost center.
     */
    public function up(): void
    {
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

        // 1. Update Tenant 7 PO Prefix to 'AV/2026-27/' so future generated PO numbers follow this pattern
        DB::table('tenants')->where('id', $avTenantId)->update([
            'po_prefix'  => 'AV/2026-27/',
            'updated_at' => now(),
        ]);

        // 2. Update PO #120 po_number to 'AV/2026-27/24'
        $po120 = DB::table('purchase_orders')->where('id', 120)->first();
        if ($po120) {
            DB::table('purchase_orders')->where('id', 120)->update([
                'po_number'  => 'AV/2026-27/24',
                'updated_at' => now(),
            ]);

            // Update TAT record if any
            if (Schema::hasTable('tat_records')) {
                DB::table('tat_records')->where('po_id', 120)->update([
                    'updated_at' => now(),
                ]);
            }
        }

        // 3. Ensure Approval record for PO 120 matches Apollo Vidhyalayam approver
        $avCostCenter = DB::table('cost_centers')
            ->where('tenant_id', $avTenantId)
            ->where('is_active', true)
            ->first();

        if (!$avCostCenter) {
            $avCostCenter = DB::table('cost_centers')->where('tenant_id', $avTenantId)->first();
        }

        if ($avCostCenter) {
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

            if (!$targetApproverId) {
                $approverRole = DB::table('user_tenant_roles')
                    ->where('tenant_id', $avTenantId)
                    ->whereIn('role', ['client_approver', 'client_admin', 'approver', 'admin'])
                    ->where('is_active', true)
                    ->first();
                $targetApproverId = $approverRole?->user_id;
            }

            if ($targetApproverId) {
                $existingApproval = DB::table('approvals')
                    ->where('entity_type', 'PO')
                    ->where('entity_id', 120)
                    ->first();

                if ($existingApproval) {
                    DB::table('approvals')
                        ->where('id', $existingApproval->id)
                        ->where('action', 'pending')
                        ->update([
                            'assigned_to_user_id' => $targetApproverId,
                            'updated_at'          => now(),
                        ]);
                } else {
                    DB::table('approvals')->insert([
                        'entity_type'         => 'PO',
                        'entity_id'           => 120,
                        'level'               => 1,
                        'assigned_to_user_id' => $targetApproverId,
                        'action'              => 'pending',
                        'created_at'          => now(),
                        'updated_at'          => now(),
                    ]);
                }
            }

            // 4. Update Budget Ledger for PO 120
            if (Schema::hasTable('budget_ledger') && $po120) {
                $existingFreeze = DB::table('budget_ledger')
                    ->where('reference_type', 'PO')
                    ->where('reference_id', 120)
                    ->where('action', 'freeze')
                    ->first();

                if ($existingFreeze) {
                    DB::table('budget_ledger')
                        ->where('id', $existingFreeze->id)
                        ->update([
                            'cost_center_id' => $avCostCenter->id,
                            'freeze_amount'  => $po120->grand_total,
                            'updated_at'     => now(),
                        ]);
                } else {
                    DB::table('budget_ledger')->insert([
                        'cost_center_id' => $avCostCenter->id,
                        'fiscal_year'    => '2026-2027',
                        'action'         => 'freeze',
                        'freeze_amount'  => $po120->grand_total,
                        'reference_type' => 'PO',
                        'reference_id'   => 120,
                        'performed_by'   => $po120->created_by,
                        'notes'          => 'Budget frozen for PO submission',
                        'created_at'     => now(),
                        'updated_at'     => now(),
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
