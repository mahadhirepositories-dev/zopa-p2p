<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Approval;
use App\Models\CostCenter;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Services\BudgetService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(private BudgetService $budget) {}

    public function stats(): JsonResponse
    {
        $tenant   = app('currentTenant');
        $tenantId = $tenant->id;

        // ── PO status counts ───────────────────────────────────────
        $posByStatus = PurchaseOrder::where('tenant_id', $tenantId)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // ── PR status counts ───────────────────────────────────────
        $prsByStatus = PurchaseRequisition::where('tenant_id', $tenantId)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // ── Pending approvals for current user (all entity types) ──
        $pendingApprovals = Approval::where('assigned_to_user_id', auth()->id())
            ->where('action', 'pending')
            ->where(function ($q) use ($tenantId) {
                $q->whereHas('purchaseOrder', fn ($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('purchaseRequisition', fn ($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('invoice', fn ($q2) => $q2->where('tenant_id', $tenantId));
            })
            ->count();

        // ── Recent POs ─────────────────────────────────────────────
        $recentPos = PurchaseOrder::with(['vendor:id,name', 'costCenter:id,name'])
            ->where('tenant_id', $tenantId)
            ->latest()
            ->limit(5)
            ->get(['id', 'po_number', 'status', 'grand_total', 'vendor_id', 'cost_center_id', 'created_at']);

        // ── Recent PRs ─────────────────────────────────────────────
        $recentPrs = PurchaseRequisition::with(['costCenter:id,name'])
            ->where('tenant_id', $tenantId)
            ->latest()
            ->limit(10)
            ->get(['id', 'pr_number', 'title', 'status', 'estimated_amount', 'cost_center_id', 'created_at']);

        // ── Budget summary ─────────────────────────────────────────
        $costCenters   = CostCenter::where('tenant_id', $tenantId)->where('is_active', true)->get();
        $budgetSummary = $costCenters->map(function (CostCenter $cc) {
            $fiscalYear = $this->budget->currentFiscalYear($cc->load('tenant'));
            $b          = $this->budget->getAvailable($cc->id, $fiscalYear);
            return [
                'id'        => $cc->id,
                'name'      => $cc->name,
                'annual'    => $b['annual'],
                'frozen'    => $b['frozen'],
                'consumed'  => $b['consumed'],
                'available' => $b['available'],
            ];
        });

        // ── PO KPI / TAT table (up to 30 most-recent POs) ─────────
        $kpiPos = PurchaseOrder::with([
                'vendor:id,name',
                'costCenter:id,name',
                'items:id,po_id,sno,description,qty,net_rate,gst_rate,amount,required_by,warranty_months',
                'items.product:id,code,unit',
            ])
            ->where('tenant_id', $tenantId)
            ->latest()
            ->limit(30)
            ->get([
                'id', 'po_number', 'status', 'grand_total', 'net_total', 'tax_amount',
                'vendor_id', 'cost_center_id', 'created_at', 'approved_at', 'released_at',
            ]);

        $poKpi = $kpiPos->map(function (PurchaseOrder $po) {
            $created = $po->created_at;

            $daysToApprove  = ($po->approved_at && $created)
                ? (int) $created->diffInDays($po->approved_at)
                : null;
            $daysToRelease  = ($po->approved_at && $po->released_at)
                ? (int) $po->approved_at->diffInDays($po->released_at)
                : null;
            $totalCycleDays = ($po->released_at && $created)
                ? (int) $created->diffInDays($po->released_at)
                : null;

            return [
                'id'               => $po->id,
                'po_number'        => $po->po_number,
                'status'           => $po->status,
                'vendor'           => $po->vendor?->name,
                'cost_center'      => $po->costCenter?->name,
                'grand_total'      => $po->grand_total,
                'net_total'        => $po->net_total,
                'tax_amount'       => $po->tax_amount,
                'items_count'      => $po->items->count(),
                'created_at'       => $po->created_at,
                'approved_at'      => $po->approved_at,
                'released_at'      => $po->released_at,
                'days_to_approve'  => $daysToApprove,
                'days_to_release'  => $daysToRelease,
                'total_cycle_days' => $totalCycleDays,
                'items'            => $po->items->map(fn ($item) => [
                    'sno'             => $item->sno,
                    'description'     => $item->description,
                    'code'            => $item->product?->code,
                    'uom'             => $item->product?->unit,
                    'qty'             => $item->qty,
                    'net_rate'        => $item->net_rate,
                    'gst_rate'        => $item->gst_rate,
                    'amount'          => $item->amount,
                    'required_by'     => $item->required_by,
                    'warranty_months' => $item->warranty_months,
                ]),
            ];
        });

        // ── PR KPI / TAT table (up to 20 most-recent PRs) ─────────
        $kpiPrs = PurchaseRequisition::with(['costCenter:id,name'])
            ->where('tenant_id', $tenantId)
            ->latest()
            ->limit(20)
            ->get(['id', 'pr_number', 'title', 'status', 'estimated_amount', 'cost_center_id', 'created_at']);

        // Bulk-load activity log events for TAT calculation (single query)
        $prIds        = $kpiPrs->pluck('id');
        $prActivities = ActivityLog::where('entity_type', 'PR')
            ->whereIn('entity_id', $prIds)
            ->whereIn('action', ['submitted', 'rfq_created', 'rfq_approved', 'converted'])
            ->orderBy('created_at')
            ->get(['entity_id', 'action', 'created_at'])
            ->groupBy('entity_id');

        $prKpi = $kpiPrs->map(function (PurchaseRequisition $pr) use ($prActivities) {
            $logs = $prActivities->get($pr->id, collect());

            // Use first occurrence of each milestone
            $submittedAt   = $logs->firstWhere('action', 'submitted')?->created_at;
            $rfqCreatedAt  = $logs->firstWhere('action', 'rfq_created')?->created_at;
            $rfqApprovedAt = $logs->firstWhere('action', 'rfq_approved')?->created_at;
            $convertedAt   = $logs->firstWhere('action', 'converted')?->created_at;

            $created = $pr->created_at;

            return [
                'id'               => $pr->id,
                'pr_number'        => $pr->pr_number,
                'title'            => $pr->title,
                'status'           => $pr->status,
                'cost_center'      => $pr->costCenter?->name,
                'estimated_amount' => $pr->estimated_amount,
                'created_at'       => $created,
                'submitted_at'     => $submittedAt,
                'rfq_created_at'   => $rfqCreatedAt,
                'rfq_approved_at'  => $rfqApprovedAt,
                'converted_at'     => $convertedAt,
                // TAT segments (whole days)
                'days_to_submit'   => $submittedAt
                    ? (int) $created->diffInDays($submittedAt) : null,
                'days_rfq_create'  => ($submittedAt && $rfqCreatedAt)
                    ? (int) $submittedAt->diffInDays($rfqCreatedAt) : null,
                'days_rfq_approve' => ($rfqCreatedAt && $rfqApprovedAt)
                    ? (int) $rfqCreatedAt->diffInDays($rfqApprovedAt) : null,
                'days_to_convert'  => ($rfqApprovedAt && $convertedAt)
                    ? (int) $rfqApprovedAt->diffInDays($convertedAt) : null,
                'total_cycle_days' => $convertedAt
                    ? (int) $created->diffInDays($convertedAt) : null,
            ];
        });

        return response()->json([
            'po_counts'         => $posByStatus,
            'pending_approvals' => $pendingApprovals,
            'recent_pos'        => $recentPos,
            'budget_summary'    => $budgetSummary,
            'po_kpi'            => $poKpi,
            'pr_counts'         => $prsByStatus,
            'recent_prs'        => $recentPrs,
            'pr_kpi'            => $prKpi,
        ]);
    }
}
