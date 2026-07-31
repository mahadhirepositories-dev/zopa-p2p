<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Approval;
use App\Models\CostCenter;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\TatRecord;
use App\Services\BudgetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function __construct(private BudgetService $budget) {}

    public function stats(Request $request): JsonResponse
    {
        $tenant   = app('currentTenant');
        $tenantId = $tenant->id;

        $period   = $request->input('period', 'all');
        $fromDate = $request->input('from_date');
        $toDate   = $request->input('to_date');

        // ── Helper to apply date range filter ─────────────────────────
        $applyFilter = function ($query, string $dateColumn = 'created_at') use ($period, $fromDate, $toDate) {
            return match ($period) {
                'today'      => $query->whereDate($dateColumn, now()->toDateString()),
                'this_week'  => $query->whereBetween($dateColumn, [now()->startOfWeek(), now()->endOfWeek()]),
                'this_month' => $query->whereBetween($dateColumn, [now()->startOfMonth(), now()->endOfMonth()]),
                'this_year'  => $query->whereBetween($dateColumn, [now()->startOfYear(), now()->endOfYear()]),
                'custom'     => ($fromDate && $toDate) 
                                ? $query->whereBetween($dateColumn, [$fromDate . ' 00:00:00', $toDate . ' 23:59:59'])
                                : $query,
                default      => $query,
            };
        };

        // ── PO status counts ───────────────────────────────────────
        $poQuery = PurchaseOrder::where('tenant_id', $tenantId);
        $applyFilter($poQuery, 'created_at');
        $posByStatus = (clone $poQuery)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // ── PR status counts ───────────────────────────────────────
        $prQuery = PurchaseRequisition::where('tenant_id', $tenantId);
        $applyFilter($prQuery, 'created_at');
        $prsByStatus = (clone $prQuery)
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
        $recentPos = (clone $poQuery)
            ->with(['vendor:id,name', 'costCenter:id,name'])
            ->latest()
            ->limit(5)
            ->get(['id', 'po_number', 'status', 'grand_total', 'vendor_id', 'cost_center_id', 'created_at']);

        // ── Recent PRs ─────────────────────────────────────────────
        $recentPrs = (clone $prQuery)
            ->with(['costCenter:id,name'])
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

        // ── PO KPI / TAT table ─────────────────────────────────────
        $kpiPos = (clone $poQuery)
            ->with([
                'vendor:id,name',
                'costCenter:id,name',
                'items:id,po_id,sno,description,qty,net_rate,gst_rate,amount,required_by,warranty_months',
                'items.product:id,code,unit',
            ])
            ->latest()
            ->limit(30)
            ->get([
                'id', 'po_number', 'status', 'grand_total', 'net_total', 'tax_amount',
                'vendor_id', 'cost_center_id', 'created_at', 'approved_at', 'released_at', 'delivered_at'
            ]);

        $poIds     = $kpiPos->pluck('id');
        $tatRecords = TatRecord::whereIn('po_id', $poIds)->get()->keyBy('po_id');

        $poKpi = $kpiPos->map(function (PurchaseOrder $po) use ($tatRecords) {
            $created = $po->created_at;
            $tat = $tatRecords->get($po->id);

            $approvedAt  = $po->approved_at ?? $tat?->po_approved_at;
            $releasedAt  = $po->released_at ?? $tat?->po_released_at;
            $deliveredAt = $po->delivered_at ?? $tat?->po_delivered_at ?? $tat?->grn_received_at;

            $daysToApprove  = ($approvedAt && $created) ? round($created->diffInHours($approvedAt) / 24, 1) : null;
            $daysToRelease  = ($approvedAt && $releasedAt) ? round($approvedAt->diffInHours($releasedAt) / 24, 1) : null;
            $daysToDeliver  = ($releasedAt && $deliveredAt) ? round($releasedAt->diffInHours($deliveredAt) / 24, 1) : null;
            $totalCycleDays = ($deliveredAt && $created) ? round($created->diffInHours($deliveredAt) / 24, 1) 
                            : (($releasedAt && $created) ? round($created->diffInHours($releasedAt) / 24, 1) : null);

            // Intuitiveness Status Badge
            $tatBadge = 'On Track';
            $badgeColor = 'green';
            if ($totalCycleDays !== null) {
                if ($totalCycleDays > 7) {
                    $tatBadge = 'Delayed';
                    $badgeColor = 'red';
                } elseif ($totalCycleDays > 3) {
                    $tatBadge = 'Moderate';
                    $badgeColor = 'orange';
                }
            }

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
                'approved_at'      => $approvedAt,
                'released_at'      => $releasedAt,
                'delivered_at'     => $deliveredAt,
                'days_to_approve'  => $daysToApprove,
                'days_to_release'  => $daysToRelease,
                'days_to_deliver'  => $daysToDeliver,
                'total_cycle_days' => $totalCycleDays,
                'tat_badge'        => $tatBadge,
                'badge_color'      => $badgeColor,
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

        // ── PR KPI / TAT table ─────────────────────────────────────
        $kpiPrs = (clone $prQuery)
            ->with(['costCenter:id,name'])
            ->latest()
            ->limit(20)
            ->get(['id', 'pr_number', 'title', 'status', 'estimated_amount', 'cost_center_id', 'created_at']);

        $prIds        = $kpiPrs->pluck('id');
        $prActivities = ActivityLog::where('entity_type', 'PR')
            ->whereIn('entity_id', $prIds)
            ->whereIn('action', ['submitted', 'rfq_created', 'rfq_approved', 'converted', 'short_closed'])
            ->orderBy('created_at')
            ->get(['entity_id', 'action', 'created_at'])
            ->groupBy('entity_id');

        $prKpi = $kpiPrs->map(function (PurchaseRequisition $pr) use ($prActivities) {
            $logs = $prActivities->get($pr->id, collect());

            $submittedAt   = $logs->firstWhere('action', 'submitted')?->created_at;
            $rfqCreatedAt  = $logs->firstWhere('action', 'rfq_created')?->created_at;
            $rfqApprovedAt = $logs->firstWhere('action', 'rfq_approved')?->created_at;
            $convertedAt   = $logs->firstWhere('action', 'converted')?->created_at;
            $created       = $pr->created_at;

            $daysToSubmit   = $submittedAt ? round($created->diffInHours($submittedAt) / 24, 1) : null;
            $daysRfqCreate  = ($submittedAt && $rfqCreatedAt) ? round($submittedAt->diffInHours($rfqCreatedAt) / 24, 1) : null;
            $daysRfqApprove = ($rfqCreatedAt && $rfqApprovedAt) ? round($rfqCreatedAt->diffInHours($rfqApprovedAt) / 24, 1) : null;
            $daysToConvert  = ($rfqApprovedAt && $convertedAt) ? round($rfqApprovedAt->diffInHours($convertedAt) / 24, 1) : null;
            $totalCycleDays = $convertedAt ? round($created->diffInHours($convertedAt) / 24, 1) : null;

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
                'days_to_submit'   => $daysToSubmit,
                'days_rfq_create'  => $daysRfqCreate,
                'days_rfq_approve' => $daysRfqApprove,
                'days_to_convert'  => $daysToConvert,
                'total_cycle_days' => $totalCycleDays,
            ];
        });

        // ── Overall Average TAT Summary ───────────────────────────
        $allTats = TatRecord::whereHas('po', fn($q) => $q->where('tenant_id', $tenantId))->get();
        $avgApprovalDays = round($allTats->filter(fn($t) => $t->po_created_at && $t->po_approved_at)
            ->avg(fn($t) => $t->po_created_at->diffInHours($t->po_approved_at) / 24) ?? 0, 1);

        $avgReleaseDays = round($allTats->filter(fn($t) => $t->po_approved_at && $t->po_released_at)
            ->avg(fn($t) => $t->po_approved_at->diffInHours($t->po_released_at) / 24) ?? 0, 1);

        $avgDeliveryDays = round($allTats->filter(fn($t) => $t->po_released_at && ($t->po_delivered_at ?? $t->grn_received_at))
            ->avg(fn($t) => $t->po_released_at->diffInHours($t->po_delivered_at ?? $t->grn_received_at) / 24) ?? 0, 1);

        $avgTotalDays = round($allTats->filter(fn($t) => $t->po_created_at && ($t->po_delivered_at ?? $t->po_released_at))
            ->avg(fn($t) => $t->po_created_at->diffInHours($t->po_delivered_at ?? $t->po_released_at) / 24) ?? 0, 1);

        return response()->json([
            'filter' => [
                'period'    => $period,
                'from_date' => $fromDate,
                'to_date'   => $toDate,
            ],
            'tat_summary' => [
                'avg_approval_days' => $avgApprovalDays,
                'avg_release_days'  => $avgReleaseDays,
                'avg_delivery_days' => $avgDeliveryDays,
                'avg_total_days'    => $avgTotalDays,
            ],
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
