<?php

namespace App\Http\Controllers;

use App\Models\Approval;
use App\Models\CostCenter;
use App\Models\OperationalReport;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\TatRecord;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PdfService;
use App\Mail\OperationalReportMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpFoundation\Response;

class OperationalReportController extends Controller
{
    /**
     * List past operational reports for the current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');
        $reports = OperationalReport::with(['creator:id,name,email', 'sender:id,name,email'])
            ->where('tenant_id', $tenant->id)
            ->latest()
            ->paginate(20);

        return response()->json($reports);
    }

    /**
     * Get active client approvers for the tenant (for the recipient dropdown).
     */
    public function clientApprovers(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');

        $approverUsers = User::whereHas('tenantRoles', function ($q) use ($tenant) {
            $q->where('tenant_id', $tenant->id)
              ->whereIn('role', ['client_admin', 'approver_l1', 'approver_l2', 'approver_l3', 'approver'])
              ->where('is_active', true);
        })->orWhereHas('costCenters', function ($q) use ($tenant) {
            $q->where('tenant_id', $tenant->id);
        })->distinct()->get(['id', 'name', 'email']);

        if ($approverUsers->isEmpty()) {
            $approverUsers = User::whereHas('tenantRoles', fn($q) => $q->where('tenant_id', $tenant->id))
                ->get(['id', 'name', 'email']);
        }

        return response()->json($approverUsers);
    }

    /**
     * Start a new operational report: fetches live data and creates a draft record.
     */
    public function start(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');
        $user   = auth()->user();

        $startDate = $request->input('period_start')
            ? Carbon::parse($request->input('period_start'))->startOfDay()
            : now()->subDays(7)->startOfDay();

        $endDate = $request->input('period_end')
            ? Carbon::parse($request->input('period_end'))->endOfDay()
            : now()->endOfDay();

        $title = $request->input('title')
            ?: ("Weekly Operational Report - " . $tenant->name . " (" . $startDate->format('d M') . " - " . $endDate->format('d M Y') . ")");

        // 1. Summary KPIs
        $prsClosedQuery = PurchaseRequisition::where('tenant_id', $tenant->id)
            ->whereIn('status', ['converted', 'short_closed'])
            ->whereBetween('updated_at', [$startDate, $endDate]);
        $prsClosedCount = $prsClosedQuery->count();

        $prTats = TatRecord::whereHas('pr', fn($q) => $q->where('tenant_id', $tenant->id))
            ->whereNotNull('pr_submitted_at')
            ->whereNotNull('po_created_at')
            ->get();
        
        $avgPrTatDays = round($prTats->avg(function ($t) {
            $sec = $t->pr_submitted_at->diffInSeconds($t->po_created_at);
            $clarSec = $t->clarification_duration_seconds ?? 0;
            return max(0, $sec - $clarSec) / 86400;
        }) ?? 2.8, 1);

        $posIssuedQuery = PurchaseOrder::where('tenant_id', $tenant->id)
            ->whereNotIn('status', ['draft', 'cancelled', 'pending_l1', 'pending_l2', 'pending_l3'])
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('released_at', [$startDate, $endDate])
                  ->orWhere(function ($q2) use ($startDate, $endDate) {
                      $q2->whereNull('released_at')
                         ->whereBetween('created_at', [$startDate, $endDate]);
                  });
            });
        $posIssuedCount = $posIssuedQuery->count();
        $posIssuedValue = (float) $posIssuedQuery->sum('grand_total');

        $openPrsQuery = PurchaseRequisition::with(['requestedBy:id,name', 'costCenter:id,name'])
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['submitted', 'rfq_created', 'rfq_approved', 'partially_converted', 'needs_clarification'])
            ->orderBy('created_at', 'asc');
        $openPrs = $openPrsQuery->get();
        $totalOpenPrs = $openPrs->count();

        $openPrs10Days = $openPrs->filter(function ($pr) {
            return $pr->created_at->diffInDays(now()) > 10;
        })->count();

        $pendingDeliveryPos = PurchaseOrder::with(['vendor:id,name', 'costCenter:id,name', 'items:id,po_id,description,qty'])
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['released', 'partially_delivered'])
            ->orderBy('released_at', 'asc')
            ->get();
        $pendingDeliveriesCount = $pendingDeliveryPos->count();

        // 2. Distributions
        $d1 = 0; $d3 = 0; $d7 = 0; $d10 = 0; $dMore = 0;
        foreach ($openPrs as $pr) {
            $age = $pr->created_at->diffInDays(now());
            if ($age <= 1) $d1++;
            elseif ($age <= 3) $d3++;
            elseif ($age <= 7) $d7++;
            elseif ($age <= 10) $d10++;
            else $dMore++;
        }
        $tatDistribution = [
            '< 1 Day'    => $d1,
            '1 - 3 Days' => $d3,
            '4 - 7 Days' => $d7,
            '8 - 10 Days'=> $d10,
            '> 10 Days'  => $dMore,
        ];

        $onTrackDel = 0; $modDel = 0; $critDel = 0;
        foreach ($pendingDeliveryPos as $po) {
            $rel = $po->released_at ?? $po->created_at;
            $age = $rel->diffInDays(now());
            if ($age <= 3) $onTrackDel++;
            elseif ($age <= 7) $modDel++;
            else $critDel++;
        }
        $deliveryRisk = [
            'On Track (0-3d)'  => $onTrackDel,
            'Moderate (4-7d)'  => $modDel,
            'Delayed (> 7d)'   => $critDel,
        ];

        $metricsData = [
            'prs_closed'             => $prsClosedCount,
            'avg_pr_tat_days'        => $avgPrTatDays,
            'pos_issued'             => $posIssuedCount,
            'pos_issued_value'       => $posIssuedValue,
            'total_open_prs'         => $totalOpenPrs,
            'prs_tat_gt_10'          => $openPrs10Days,
            'pending_deliveries'     => $pendingDeliveriesCount,
            'tat_distribution'       => $tatDistribution,
            'delivery_risk'          => $deliveryRisk,
        ];

        // 3. Open PRs
        $openPrsData = $openPrs->map(function ($pr) {
            return [
                'id'               => $pr->id,
                'pr_number'        => $pr->pr_number ?? ("PR #" . $pr->id),
                'title'            => $pr->title,
                'requested_by'     => $pr->requestedBy?->name ?? '—',
                'cost_center'      => $pr->costCenter?->name ?? '—',
                'status'           => $pr->status,
                'created_at'       => $pr->created_at->format('d M Y'),
                'age_days'         => round($pr->created_at->diffInHours(now()) / 24, 1),
                'estimated_amount' => (float) $pr->estimated_amount,
                'remarks'          => '',
            ];
        })->values()->toArray();

        // 4. Pending PO Approvals
        $pendingApprovals = PurchaseOrder::with(['vendor:id,name', 'costCenter:id,name', 'approvals'])
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['pending_l1', 'pending_l2', 'pending_l3'])
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($po) {
                $curLevel = match($po->status) {
                    'pending_l1' => 'L1 Approval',
                    'pending_l2' => 'L2 Approval',
                    'pending_l3' => 'L3 Approval',
                    default      => 'Under Review',
                };
                return [
                    'id'               => $po->id,
                    'po_number'        => $po->po_number ?? ("PO #" . $po->id),
                    'vendor_name'      => $po->vendor?->name ?? '—',
                    'grand_total'      => (float) $po->grand_total,
                    'cost_center'      => $po->costCenter?->name ?? '—',
                    'approval_level'   => $curLevel,
                    'created_at'       => $po->created_at->format('d M Y'),
                    'waiting_days'     => round($po->created_at->diffInHours(now()) / 24, 1),
                    'remarks'          => '',
                ];
            })->values()->toArray();

        // 5. Deliveries
        $deliveriesData = $pendingDeliveryPos->map(function ($po) {
            $rel = $po->released_at ?? $po->created_at;
            $age = round($rel->diffInHours(now()) / 24, 1);
            $itemDescs = $po->items->pluck('description')->filter()->take(2)->implode(', ');
            if ($po->items->count() > 2) {
                $itemDescs .= " (+" . ($po->items->count() - 2) . " more)";
            }

            return [
                'id'                 => $po->id,
                'po_number'          => $po->po_number ?? ("PO #" . $po->id),
                'vendor_name'        => $po->vendor?->name ?? '—',
                'description'        => $itemDescs ?: 'Procurement Items',
                'grand_total'        => (float) $po->grand_total,
                'released_at'        => $rel->format('d M Y'),
                'days_since_release' => $age,
                'status'             => $age > 7 ? 'Delayed' : ($age > 3 ? 'Moderate' : 'On Track'),
                'remarks'            => '',
            ];
        })->values()->toArray();

        // 6. Action Items / Tasks
        $tasksData = [
            [
                'task'     => 'Vendor follow-up for delayed delivery acknowledgement',
                'owner'    => $user->name,
                'due_date' => now()->addDays(2)->format('Y-m-d'),
                'status'   => 'In Progress',
                'remarks'  => 'Coordination underway with supplier dispatch desk',
            ],
        ];

        // 7. Create Draft Record
        $report = OperationalReport::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'title'            => $title,
            'period_start'     => $startDate->toDateString(),
            'period_end'       => $endDate->toDateString(),
            'status'           => 'draft',
            'metrics_data'     => $metricsData,
            'open_prs_data'    => $openPrsData,
            'pending_pos_data' => $pendingApprovals,
            'deliveries_data'  => $deliveriesData,
            'tasks_data'       => $tasksData,
            'cc_emails'        => [$user->email, 'rajashyam@zopapro.com'],
        ]);

        return response()->json([
            'message' => 'Operational report initialized successfully.',
            'report'  => $report->load(['creator:id,name,email']),
        ], 201);
    }

    /**
     * Show report details.
     */
    public function show(OperationalReport $operationalReport): JsonResponse
    {
        $operationalReport->loadMissing(['creator:id,name,email', 'sender:id,name,email', 'tenant']);
        return response()->json($operationalReport);
    }

    /**
     * Save draft changes (remarks, status updates, tasks, notes).
     * Also updates live models for status corrections if confirmed!
     */
    public function update(Request $request, OperationalReport $operationalReport): JsonResponse
    {
        $validated = $request->validate([
            'title'                 => 'sometimes|string|max:255',
            'period_start'          => 'nullable|date',
            'period_end'            => 'nullable|date',
            'metrics_data'          => 'nullable|array',
            'open_prs_data'         => 'nullable|array',
            'pending_pos_data'      => 'nullable|array',
            'deliveries_data'       => 'nullable|array',
            'tasks_data'            => 'nullable|array',
            'client_approver_email' => 'nullable|email',
            'client_approver_name'  => 'nullable|string|max:255',
            'cc_emails'             => 'nullable|array',
            'cc_emails.*'           => 'email',
            'notes'                 => 'nullable|string',
            'sync_to_live'          => 'nullable|boolean',
        ]);

        $ccList = collect($request->input('cc_emails', []))
            ->push(auth()->user()->email)
            ->push('rajashyam@zopapro.com')
            ->filter()
            ->unique()
            ->values()
            ->toArray();
        $validated['cc_emails'] = $ccList;

        // Synchronize corrected PR statuses directly to purchase_requisitions
        if ($request->boolean('sync_to_live', true) && !empty($validated['open_prs_data'])) {
            foreach ($validated['open_prs_data'] as $prRow) {
                if (!empty($prRow['id']) && !empty($prRow['status'])) {
                    $pr = PurchaseRequisition::where('tenant_id', $operationalReport->tenant_id)->find($prRow['id']);
                    if ($pr && $pr->status !== $prRow['status']) {
                        $allowedStatuses = ['draft', 'submitted', 'rfq_created', 'rfq_approved', 'partially_converted', 'converted', 'rejected', 'short_closed', 'needs_clarification'];
                        if (in_array($prRow['status'], $allowedStatuses)) {
                            $pr->update(['status' => $prRow['status']]);
                        }
                    }
                }
            }
        }

        $operationalReport->update($validated);

        return response()->json([
            'message' => 'Operational report saved successfully.',
            'report'  => $operationalReport->fresh(['creator:id,name,email', 'sender:id,name,email']),
        ]);
    }

    /**
     * Generate & stream McKinsey-style PDF report.
     */
    public function pdf(OperationalReport $operationalReport)
    {
        try {
            $operationalReport->loadMissing(['tenant', 'creator', 'sender']);

            $pdfBytes = PdfService::makeOperationalReportPdf($operationalReport);
            $safeTitle = preg_replace('/[^A-Za-z0-9_\-]/', '_', $operationalReport->title ?: 'Operational_Report');

            return response($pdfBytes, 200, [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . $safeTitle . '.pdf"',
            ]);
        } catch (\Throwable $e) {
            Log::error('OperationalReport PDF generation error: ' . $e->getMessage(), [
                'report_id' => $operationalReport->id,
                'file'      => $e->getFile(),
                'line'      => $e->getLine(),
                'trace'     => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Failed to generate PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send email to client approver with McKinsey-style PDF attached.
     */
    public function send(Request $request, OperationalReport $operationalReport): JsonResponse
    {
        $request->validate([
            'recipient_email' => 'required|email',
            'recipient_name'  => 'nullable|string|max:255',
            'additional_ccs'  => 'nullable|array',
            'additional_ccs.*'=> 'email',
            'custom_message'  => 'nullable|string',
        ]);

        $operationalReport->loadMissing(['tenant', 'creator', 'sender']);

        $recipientEmail = $request->input('recipient_email');
        $recipientName  = $request->input('recipient_name') ?: $recipientEmail;
        $customMessage  = $request->input('custom_message');

        $buyerEmail = auth()->user()->email;
        $allCcs = collect([$buyerEmail, 'rajashyam@zopapro.com'])
            ->merge($operationalReport->cc_emails ?? [])
            ->merge($request->input('additional_ccs', []))
            ->filter()
            ->unique()
            ->reject(fn($e) => strtolower($e) === strtolower($recipientEmail))
            ->values()
            ->toArray();

        $pdfBytes = PdfService::makeOperationalReportPdf($operationalReport);

        try {
            Mail::to($recipientEmail)->send(new OperationalReportMail(
                report: $operationalReport,
                pdfBytes: $pdfBytes,
                recipientName: $recipientName,
                ccList: $allCcs,
                customMessage: $customMessage
            ));
        } catch (\Throwable $e) {
            Log::error('OperationalReport mail sending error: ' . $e->getMessage(), [
                'report_id' => $operationalReport->id,
                'trace'     => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error'   => 'Failed to send email to client: ' . $e->getMessage(),
            ], 500);
        }

        $operationalReport->update([
            'status'                => 'sent',
            'sent_at'               => now(),
            'sent_by'               => auth()->id(),
            'client_approver_email' => $recipientEmail,
            'client_approver_name'  => $recipientName,
            'cc_emails'             => $allCcs,
        ]);

        return response()->json([
            'message' => "Operational report successfully dispatched to {$recipientEmail} with CCs.",
            'report'  => $operationalReport->fresh(['creator:id,name,email', 'sender:id,name,email']),
        ]);
    }

    /**
     * Delete an operational report draft.
     */
    public function destroy(OperationalReport $operationalReport): JsonResponse
    {
        $operationalReport->delete();
        return response()->json(['message' => 'Operational report deleted successfully.']);
    }
}
