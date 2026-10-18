<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;
use App\Models\Tenant;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Close PR65 in Total Health:
     * 1. Resolve Total Health tenant (ID 2 / code 'TH' / 'Total Health').
     * 2. Locate PR65 (via pr_number/pr_ref matching 'PR65', 'PR-65', 'PR 65', etc.).
     * 3. Mark all line items as short-closed (is_short_closed = true, remarks = 'Short Close').
     * 4. Update PR status to 'short_closed' with short_closed_at timestamp and reason.
     * 5. Release any unreleased frozen funds in budget_ledger for this PR.
     * 6. Cancel any pending approvals for this PR.
     * 7. Record activity log and flush cache.
     */
    public function up(): void
    {
        // ── 1. Resolve Total Health Tenant ────────────────────────────────────
        $tenant = Tenant::where('name', 'like', '%Total Health%')
            ->orWhere('code', 'TH')
            ->orWhere('code', 'like', '%TOTAL%')
            ->orWhere('id', 2)
            ->first();

        $tenantId = $tenant?->id ?? 2;
        echo "Resolved Total Health Tenant ID: {$tenantId}\n";

        // ── 2. Locate PR65 ────────────────────────────────────────────────────
        $candidates = [
            'PR65',
            'PR-65',
            'PR 65',
            'PR065',
            'PR-065',
            'TH/2026-27/65',
            'TH-PR-65',
            'TOTAL HEALTH-PR 65',
            '65',
        ];

        $query = PurchaseRequisition::with(['items']);
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $pr = (clone $query)->where(function ($q) use ($candidates) {
            foreach ($candidates as $c) {
                $q->orWhere('pr_number', $c)
                  ->orWhere('pr_ref', $c);
            }
            $q->orWhere('pr_number', 'like', '%PR65%')
              ->orWhere('pr_number', 'like', '%PR-65%')
              ->orWhere('pr_number', 'like', '%/65');
        })->first();

        // Fallback across all tenants if not found under specific tenant ID
        if (!$pr) {
            $pr = PurchaseRequisition::with(['items'])
                ->where(function ($q) use ($candidates) {
                    foreach ($candidates as $c) {
                        $q->orWhere('pr_number', $c)
                          ->orWhere('pr_ref', $c);
                    }
                    $q->orWhere('pr_number', 'like', '%PR65%')
                      ->orWhere('pr_number', 'like', '%PR-65%')
                      ->orWhere('pr_number', 'like', '%/65');
                })
                ->first();
        }

        if (!$pr) {
            echo "WARNING: PR65 not found!\n";
            return;
        }

        echo "Found PR65 -> ID: {$pr->id}, PR Number: '{$pr->pr_number}', Current Status: '{$pr->status}', Items count: " . $pr->items->count() . "\n";

        // ── 3. Mark All Line Items as Short Closed ────────────────────────────
        $now = now();
        foreach ($pr->items as $item) {
            $converted = (float) ($item->converted_qty ?? 0);
            $totalQty  = (float) ($item->qty ?? 0);
            $shortQty  = max(0, $totalQty - $converted);
            if ($shortQty <= 0 && $converted == 0) {
                $shortQty = $totalQty;
            }

            $item->update([
                'is_short_closed'  => true,
                'remarks'          => $item->remarks ? ($item->remarks . ' | Short Close') : 'Short Close',
                'short_closed_qty' => $shortQty > 0 ? $shortQty : $totalQty,
                'updated_at'       => $now,
            ]);

            echo "  Line item #{$item->sno} ('{$item->description}') short-closed (Short Qty: {$shortQty}).\n";
        }

        // ── 4. Update PR Record Status to 'short_closed' ──────────────────────
        $pr->update([
            'status'             => 'short_closed',
            'short_closed_at'    => $now,
            'short_closed_by'    => $pr->short_closed_by ?? ($pr->requested_by ?? 1),
            'short_close_reason' => $pr->short_close_reason ?: 'Closed as per user request',
            'converted_at'       => $pr->converted_at ?? $now,
            'updated_at'         => $now,
        ]);

        echo "Updated PR #{$pr->id} ('{$pr->pr_number}') to 'short_closed'.\n";

        // ── 5. Release Any Frozen Budget in budget_ledger ──────────────────────
        if (Schema::hasTable('budget_ledger') && $pr->cost_center_id) {
            $frozenSum = DB::table('budget_ledger')
                ->where('cost_center_id', $pr->cost_center_id)
                ->where('reference_type', 'PR')
                ->where('reference_id', $pr->id)
                ->where('action', 'freeze')
                ->sum('freeze_amount');

            $releasedSum = DB::table('budget_ledger')
                ->where('cost_center_id', $pr->cost_center_id)
                ->where('reference_type', 'PR')
                ->where('reference_id', $pr->id)
                ->where('action', 'release')
                ->sum('freeze_amount');

            $netFrozen = (float)$frozenSum - (float)$releasedSum;
            if ($netFrozen > 0.001) {
                $currentFy = now()->month >= 4 ? now()->year : now()->year - 1;
                DB::table('budget_ledger')->insert([
                    'cost_center_id' => $pr->cost_center_id,
                    'fiscal_year'    => $currentFy,
                    'reference_type' => 'PR',
                    'reference_id'   => $pr->id,
                    'freeze_amount'  => $netFrozen,
                    'consume_amount' => 0,
                    'action'         => 'release',
                    'narration'      => "Released frozen funds on short-closing PR {$pr->pr_number}",
                    'created_by'     => $pr->requested_by ?? 1,
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ]);
                echo "Released frozen budget: Rs. {$netFrozen} for Cost Center ID {$pr->cost_center_id}.\n";
            }
        }

        // ── 6. Cancel Any Pending Approvals ───────────────────────────────────
        if (Schema::hasTable('approvals')) {
            $cancelled = DB::table('approvals')
                ->where('entity_type', 'PR')
                ->where('entity_id', $pr->id)
                ->where('action', 'pending')
                ->update([
                    'action'     => 'rejected',
                    'comments'   => 'PR closed as per user request',
                    'updated_at' => $now,
                ]);
            if ($cancelled > 0) {
                echo "Cancelled {$cancelled} pending approval record(s) for PR.\n";
            }
        }

        // ── 7. Record Activity Log ────────────────────────────────────────────
        if (Schema::hasTable('activity_logs')) {
            DB::table('activity_logs')->insert([
                'tenant_id'   => $pr->tenant_id,
                'entity_type' => 'PR',
                'entity_id'   => $pr->id,
                'user_id'     => $pr->requested_by ?? 1,
                'action'      => 'short_closed',
                'meta'        => json_encode([
                    'pr_number' => $pr->pr_number,
                    'reason'    => 'Closed as per user request',
                ]),
                'created_at'  => $now,
            ]);
        }

        Cache::flush();
        echo "Successfully closed PR65 in Total Health.\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
