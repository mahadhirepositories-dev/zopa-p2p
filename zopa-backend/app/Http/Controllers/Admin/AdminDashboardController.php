<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Grn;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\TatRecord;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminDashboardController extends Controller
{
    /**
     * Consolidated stats across all tenants (or scoped to one if ?tenant_id= provided).
     * Accepts period (all, today, this_week, this_month, this_year, custom) and optional from_date & to_date.
     */
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $request->integer('tenant_id', 0);
        $period   = $request->input('period', 'all');
        $fromDate = $request->input('from_date');
        $toDate   = $request->input('to_date');

        if ($tenantId > 0) {
            $tenant = Tenant::find($tenantId);
            if (!$tenant) {
                return response()->json(['error' => 'Tenant not found.'], 404);
            }
            return response()->json($this->buildStats($tenantId, $period, $fromDate, $toDate));
        }

        // Consolidated — sum across all non-internal (client) tenants
        return response()->json($this->buildConsolidatedStats($period, $fromDate, $toDate));
    }

    /**
     * List all client tenants with their summary KPIs.
     */
    public function tenants(Request $request): JsonResponse
    {
        $period   = $request->input('period', 'all');
        $fromDate = $request->input('from_date');
        $toDate   = $request->input('to_date');

        $tenants = Tenant::select('id', 'name', 'code', 'plan', 'is_active', 'is_internal', 'created_at')
            ->orderBy('name')
            ->get();

        $result = $tenants->map(function ($t) use ($period, $fromDate, $toDate) {
            $stats = $this->buildStats($t->id, $period, $fromDate, $toDate);
            return [
                'id'          => $t->id,
                'name'        => $t->name,
                'code'        => $t->code,
                'plan'        => $t->plan,
                'is_active'   => $t->is_active,
                'created_at'  => $t->created_at,
                'kpi'         => [
                    'total_pos'         => $stats['po']['total'],
                    'total_pr'          => $stats['pr']['total'],
                    'po_value'          => $stats['po']['total_value'],
                    'pending_approvals' => $stats['po']['pending_approvals'],
                    'avg_tat_days'      => $stats['tat_summary']['avg_total_days'],
                ],
            ];
        });

        return response()->json($result);
    }

    /**
     * Export Admin Dashboard metrics as CSV.
     */
    public function export(Request $request): StreamedResponse
    {
        $tenantId = $request->integer('tenant_id', 0);
        $period   = $request->input('period', 'all');
        $fromDate = $request->input('from_date');
        $toDate   = $request->input('to_date');

        $fileName = 'zopa_admin_dashboard_export_' . now()->format('Ymd_His') . '.csv';

        if ($tenantId > 0) {
            $data = $this->buildStats($tenantId, $period, $fromDate, $toDate);
            $tenant = Tenant::find($tenantId);
            $orgName = $tenant ? $tenant->name : "Org #{$tenantId}";
        } else {
            $data = $this->buildConsolidatedStats($period, $fromDate, $toDate);
            $orgName = 'All Organizations';
        }

        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            'Pragma'              => 'no-cache',
            'Cache-Control'       => 'must-revalidate, post-check=0, pre-check=0',
            'Expires'             => '0',
        ];

        $callback = function () use ($data, $orgName, $period, $fromDate, $toDate) {
            $file = fopen('php://output', 'w');

            // Header Section
            fputcsv($file, ['ZOPA P2P ADMIN DASHBOARD EXPORT']);
            fputcsv($file, ['Scope:', $orgName]);
            fputcsv($file, ['Period:', strtoupper($period)]);
            if ($fromDate && $toDate) {
                fputcsv($file, ['Date Range:', "{$fromDate} to {$toDate}"]);
            }
            fputcsv($file, ['Exported At:', now()->format('Y-m-d H:i:s')]);
            fputcsv($file, []);

            // Consolidated Metrics Summary
            fputcsv($file, ['SUMMARY METRICS']);
            fputcsv($file, ['Metric', 'Count / Value']);
            fputcsv($file, ['Total POs', $data['po']['total']]);
            fputcsv($file, ['Total PO Value (INR)', $data['po']['total_value']]);
            fputcsv($file, ['Approved PO Value (INR)', $data['po']['approved_value']]);
            fputcsv($file, ['Pending PO Approvals', $data['po']['pending_approvals']]);
            fputcsv($file, ['Total PRs', $data['pr']['total']]);
            fputcsv($file, ['Total PR Value (INR)', $data['pr']['total_value']]);
            fputcsv($file, ['Total GRNs', $data['grn']['total']]);
            fputcsv($file, ['Total Invoices', $data['invoice']['total']]);
            fputcsv($file, []);

            // TAT Summary
            fputcsv($file, ['TAT SUMMARY (AVERAGE DAYS)']);
            fputcsv($file, ['Stage', 'Average Days']);
            fputcsv($file, ['PO Approval TAT', $data['tat_summary']['avg_approval_days'] . ' days']);
            fputcsv($file, ['PO Vendor Release TAT', $data['tat_summary']['avg_release_days'] . ' days']);
            fputcsv($file, ['GRN / Delivery TAT', $data['tat_summary']['avg_delivery_days'] . ' days']);
            fputcsv($file, ['Total Procurement Cycle TAT', $data['tat_summary']['avg_total_days'] . ' days']);
            fputcsv($file, []);

            // Organizations List
            $tenants = Tenant::where('is_internal', false)->orderBy('name')->get();
            fputcsv($file, ['ORGANIZATION PERFORMANCE BREAKDOWN']);
            fputcsv($file, ['Org ID', 'Org Name', 'Plan', 'Status', 'Total POs', 'PO Value (INR)', 'Pending Approvals', 'Total PRs', 'Avg TAT (Days)']);

            foreach ($tenants as $t) {
                $tStats = $this->buildStats($t->id, $period, $fromDate, $toDate);
                fputcsv($file, [
                    $t->id,
                    $t->name,
                    $t->plan,
                    $t->is_active ? 'Active' : 'Inactive',
                    $tStats['po']['total'],
                    $tStats['po']['total_value'],
                    $tStats['po']['pending_approvals'],
                    $tStats['pr']['total'],
                    $tStats['tat_summary']['avg_total_days'],
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    private function applyDateFilter($query, string $period, ?string $fromDate, ?string $toDate, string $column = 'created_at')
    {
        return match ($period) {
            'today'      => $query->whereDate($column, now()->toDateString()),
            'this_week'  => $query->whereBetween($column, [now()->startOfWeek(), now()->endOfWeek()]),
            'this_month' => $query->whereBetween($column, [now()->startOfMonth(), now()->endOfMonth()]),
            'this_year'  => $query->whereBetween($column, [now()->startOfYear(), now()->endOfYear()]),
            'custom'     => ($fromDate && $toDate)
                            ? $query->whereBetween($column, [$fromDate . ' 00:00:00', $toDate . ' 23:59:59'])
                            : $query,
            default      => $query,
        };
    }

    private function buildStats(int $tenantId, string $period = 'all', ?string $fromDate = null, ?string $toDate = null): array
    {
        $poBase  = PurchaseOrder::where('tenant_id', $tenantId);
        $prBase  = PurchaseRequisition::where('tenant_id', $tenantId);
        $grnBase = Grn::where('tenant_id', $tenantId);
        $invBase = Invoice::where('tenant_id', $tenantId);

        $this->applyDateFilter($poBase, $period, $fromDate, $toDate, 'created_at');
        $this->applyDateFilter($prBase, $period, $fromDate, $toDate, 'created_at');
        $this->applyDateFilter($grnBase, $period, $fromDate, $toDate, 'created_at');
        $this->applyDateFilter($invBase, $period, $fromDate, $toDate, 'created_at');

        // TAT summary calculation for this tenant
        $allTats = TatRecord::whereHas('po', fn($q) => $q->where('tenant_id', $tenantId))->get();

        $avgApprovalDays = round($allTats->filter(fn($t) => $t->po_created_at && $t->po_approved_at)
            ->avg(fn($t) => $t->po_created_at->diffInHours($t->po_approved_at) / 24) ?? 0, 1);

        $avgReleaseDays = round($allTats->filter(fn($t) => $t->po_approved_at && $t->po_released_at)
            ->avg(fn($t) => $t->po_approved_at->diffInHours($t->po_released_at) / 24) ?? 0, 1);

        $avgDeliveryDays = round($allTats->filter(fn($t) => $t->po_released_at && ($t->po_delivered_at ?? $t->grn_received_at))
            ->avg(fn($t) => $t->po_released_at->diffInHours($t->po_delivered_at ?? $t->grn_received_at) / 24) ?? 0, 1);

        $avgTotalDays = round($allTats->filter(fn($t) => $t->po_created_at && ($t->po_delivered_at ?? $t->po_released_at))
            ->avg(fn($t) => $t->po_created_at->diffInHours($t->po_delivered_at ?? $t->po_released_at) / 24) ?? 0, 1);

        return [
            'tenant_id' => $tenantId,
            'period'    => $period,
            'tat_summary' => [
                'avg_approval_days' => $avgApprovalDays,
                'avg_release_days'  => $avgReleaseDays,
                'avg_delivery_days' => $avgDeliveryDays,
                'avg_total_days'    => $avgTotalDays,
            ],
            'po' => [
                'total'             => (clone $poBase)->count(),
                'draft'             => (clone $poBase)->where('status', 'draft')->count(),
                'pending_approvals' => (clone $poBase)->whereIn('status', ['pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved'          => (clone $poBase)->where('status', 'approved')->count(),
                'released'          => (clone $poBase)->where('status', 'released')->count(),
                'delivered'         => (clone $poBase)->where('status', 'delivered')->count(),
                'invoiced'          => (clone $poBase)->where('status', 'invoiced')->count(),
                'payment_released'  => (clone $poBase)->where('status', 'payment_released')->count(),
                'cancelled'         => (clone $poBase)->where('status', 'cancelled')->count(),
                'total_value'       => (float) (clone $poBase)->sum('grand_total'),
                'approved_value'    => (float) (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->sum('grand_total'),
            ],
            'pr' => [
                'total'         => (clone $prBase)->count(),
                'draft'         => (clone $prBase)->where('status', 'draft')->count(),
                'submitted'     => (clone $prBase)->where('status', 'submitted')->count(),
                'rfq_created'   => (clone $prBase)->where('status', 'rfq_created')->count(),
                'rfq_approved'  => (clone $prBase)->where('status', 'rfq_approved')->count(),
                'converted'     => (clone $prBase)->where('status', 'converted')->count(),
                'rejected'      => (clone $prBase)->where('status', 'rejected')->count(),
                'total_value'   => (float) (clone $prBase)->sum('estimated_amount'),
            ],
            'grn' => [
                'total'    => (clone $grnBase)->count(),
                'pending'  => (clone $grnBase)->where('status', 'pending')->count(),
                'confirmed'=> (clone $grnBase)->where('status', 'confirmed')->count(),
            ],
            'invoice' => [
                'total'    => (clone $invBase)->count(),
                'pending'  => (clone $invBase)->whereIn('status', ['pending', 'pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved' => (clone $invBase)->where('status', 'approved')->count(),
                'rejected' => (clone $invBase)->where('status', 'rejected')->count(),
                'total_value' => (float) (clone $invBase)->sum('amount'),
            ],
        ];
    }

    private function buildConsolidatedStats(string $period = 'all', ?string $fromDate = null, ?string $toDate = null): array
    {
        $clientIds = Tenant::where('is_internal', false)->pluck('id');

        $poBase  = PurchaseOrder::whereIn('tenant_id', $clientIds);
        $prBase  = PurchaseRequisition::whereIn('tenant_id', $clientIds);
        $grnBase = Grn::whereIn('tenant_id', $clientIds);
        $invBase = Invoice::whereIn('tenant_id', $clientIds);

        $this->applyDateFilter($poBase, $period, $fromDate, $toDate, 'created_at');
        $this->applyDateFilter($prBase, $period, $fromDate, $toDate, 'created_at');
        $this->applyDateFilter($grnBase, $period, $fromDate, $toDate, 'created_at');
        $this->applyDateFilter($invBase, $period, $fromDate, $toDate, 'created_at');

        // Consolidated TAT averages
        $allTats = TatRecord::whereHas('po', fn($q) => $q->whereIn('tenant_id', $clientIds))->get();

        $avgApprovalDays = round($allTats->filter(fn($t) => $t->po_created_at && $t->po_approved_at)
            ->avg(fn($t) => $t->po_created_at->diffInHours($t->po_approved_at) / 24) ?? 0, 1);

        $avgReleaseDays = round($allTats->filter(fn($t) => $t->po_approved_at && $t->po_released_at)
            ->avg(fn($t) => $t->po_approved_at->diffInHours($t->po_released_at) / 24) ?? 0, 1);

        $avgDeliveryDays = round($allTats->filter(fn($t) => $t->po_released_at && ($t->po_delivered_at ?? $t->grn_received_at))
            ->avg(fn($t) => $t->po_released_at->diffInHours($t->po_delivered_at ?? $t->grn_received_at) / 24) ?? 0, 1);

        $avgTotalDays = round($allTats->filter(fn($t) => $t->po_created_at && ($t->po_delivered_at ?? $t->po_released_at))
            ->avg(fn($t) => $t->po_created_at->diffInHours($t->po_delivered_at ?? $t->po_released_at) / 24) ?? 0, 1);

        return [
            'is_consolidated' => true,
            'tenant_count'    => $clientIds->count(),
            'period'          => $period,
            'tat_summary'     => [
                'avg_approval_days' => $avgApprovalDays,
                'avg_release_days'  => $avgReleaseDays,
                'avg_delivery_days' => $avgDeliveryDays,
                'avg_total_days'    => $avgTotalDays,
            ],
            'po' => [
                'total'             => (clone $poBase)->count(),
                'draft'             => (clone $poBase)->where('status', 'draft')->count(),
                'pending_approvals' => (clone $poBase)->whereIn('status', ['pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved'          => (clone $poBase)->where('status', 'approved')->count(),
                'released'          => (clone $poBase)->where('status', 'released')->count(),
                'delivered'         => (clone $poBase)->where('status', 'delivered')->count(),
                'invoiced'          => (clone $poBase)->where('status', 'invoiced')->count(),
                'payment_released'  => (clone $poBase)->where('status', 'payment_released')->count(),
                'cancelled'         => (clone $poBase)->where('status', 'cancelled')->count(),
                'total_value'       => (float) (clone $poBase)->sum('grand_total'),
                'approved_value'    => (float) (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->sum('grand_total'),
            ],
            'pr' => [
                'total'        => (clone $prBase)->count(),
                'draft'        => (clone $prBase)->where('status', 'draft')->count(),
                'submitted'    => (clone $prBase)->where('status', 'submitted')->count(),
                'rfq_created'  => (clone $prBase)->where('status', 'rfq_created')->count(),
                'rfq_approved' => (clone $prBase)->where('status', 'rfq_approved')->count(),
                'converted'    => (clone $prBase)->where('status', 'converted')->count(),
                'rejected'     => (clone $prBase)->where('status', 'rejected')->count(),
                'total_value'  => (float) (clone $prBase)->sum('estimated_amount'),
            ],
            'grn' => [
                'total'     => (clone $grnBase)->count(),
                'pending'   => (clone $grnBase)->where('status', 'pending')->count(),
                'confirmed' => (clone $grnBase)->where('status', 'confirmed')->count(),
            ],
            'invoice' => [
                'total'       => (clone $invBase)->count(),
                'pending'     => (clone $invBase)->whereIn('status', ['pending', 'pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved'    => (clone $invBase)->where('status', 'approved')->count(),
                'rejected'    => (clone $invBase)->where('status', 'rejected')->count(),
                'total_value' => (float) (clone $invBase)->sum('amount'),
            ],
        ];
    }
}
