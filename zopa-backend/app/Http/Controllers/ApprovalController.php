<?php

namespace App\Http\Controllers;

use App\Models\Approval;
use App\Models\EmailActionToken;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Services\ActivityLogService;
use App\Services\ApprovalService;
use App\Services\TokenService;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalController extends Controller
{
    use AuthorizesRoles;

    public function __construct(
        private ApprovalService    $approvals,
        private TokenService       $tokens,
        private ActivityLogService $actLog,
    ) {}

    public function pending(Request $request): JsonResponse
    {
        $tenantId = app('currentTenant')->id;

        $approvals = Approval::with([
                'purchaseOrder' => fn($q) => $q->with('vendor', 'costCenter'),
                'invoice' => fn($q) => $q->with(['purchaseOrder:id,po_number', 'purchaseOrder.vendor']),
                'purchaseRequisition:id,pr_number,title,cost_center_id,estimated_amount',
            ])
            ->where('assigned_to_user_id', auth()->id())
            ->where('action', 'pending')
            // Tenant isolation: only show approvals belonging to the current tenant
            ->where(function ($q) use ($tenantId) {
                $q->whereHas('purchaseOrder', fn($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('purchaseRequisition', fn($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('invoice', fn($q2) => $q2->where('tenant_id', $tenantId));
            })
            ->latest()
            ->paginate(20);

        return response()->json($approvals);
    }

    public function export(Request $request)
    {
        $tenantId = app('currentTenant')->id;

        $query = Approval::with([
                'purchaseOrder' => fn($q) => $q->with('vendor', 'costCenter'),
                'invoice' => fn($q) => $q->with(['purchaseOrder:id,po_number', 'purchaseOrder.vendor']),
                'purchaseRequisition:id,pr_number,title,cost_center_id,estimated_amount',
            ])
            ->where('assigned_to_user_id', auth()->id())
            ->where('action', 'pending')
            ->where(function ($q) use ($tenantId) {
                $q->whereHas('purchaseOrder', fn($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('purchaseRequisition', fn($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('invoice', fn($q2) => $q2->where('tenant_id', $tenantId));
            });

        $data = $query->latest()->get()->map(function($a) {
            $docNum = '';
            $desc = '';
            $amount = 0;
            if ($a->entity_type === 'PO') {
                $docNum = optional($a->purchaseOrder)->po_number ?? 'Draft';
                $desc = optional(optional($a->purchaseOrder)->vendor)->name;
                $amount = optional($a->purchaseOrder)->grand_total;
            } elseif ($a->entity_type === 'PR') {
                $docNum = optional($a->purchaseRequisition)->pr_number ?? 'Draft';
                $desc = optional($a->purchaseRequisition)->title;
                $amount = optional($a->purchaseRequisition)->estimated_amount;
            } elseif ($a->entity_type === 'Invoice') {
                $docNum = optional($a->invoice)->invoice_number;
                $desc = optional(optional(optional($a->invoice)->purchaseOrder)->vendor)->name;
                $amount = optional($a->invoice)->grand_total;
            }

            return [
                'Entity Type' => $a->entity_type,
                'Document' => $docNum,
                'Description' => $desc,
                'Amount' => $amount,
                'Level' => 'L' . $a->level,
                'Requested On' => $a->created_at->format('Y-m-d H:i'),
            ];
        });

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\GenericExport($data, ['Entity Type', 'Document', 'Description', 'Amount', 'Level', 'Requested On']),
            'pending_approvals.xlsx'
        );
    }

    /**
     * Admin oversight: every pending approval in the current tenant, regardless of
     * who it's assigned to — READ-ONLY visibility so admins can see what's awaiting
     * whom. This endpoint grants no approve/reject power; the assigned approver
     * still acts. Includes the assigned approver so the UI can show "awaiting X".
     */
    public function allPending(Request $request): JsonResponse
    {
        $this->requireAdminRole();
        $tenantId = app('currentTenant')->id;

        $approvals = Approval::with([
                'assignedTo:id,name,email',
                'purchaseOrder' => fn($q) => $q->with('vendor', 'costCenter'),
                'invoice' => fn($q) => $q->with(['purchaseOrder:id,po_number', 'purchaseOrder.vendor']),
                'purchaseRequisition:id,pr_number,title,cost_center_id,estimated_amount',
            ])
            ->where('action', 'pending')
            ->where(function ($q) use ($tenantId) {
                $q->whereHas('purchaseOrder', fn($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('purchaseRequisition', fn($q2) => $q2->where('tenant_id', $tenantId))
                  ->orWhereHas('invoice', fn($q2) => $q2->where('tenant_id', $tenantId));
            })
            ->orderBy('level')
            ->latest()
            ->paginate(50);

        return response()->json($approvals);
    }

    public function approve(Request $request, Approval $approval): JsonResponse
    {
        $this->requirePermission('approvals', 'edit');
        $this->ensureAssigned($approval);
        $this->approvals->approve($approval, $request->input('comments', ''));

        $this->actLog->log(
            $approval->entity_type,
            $approval->entity_id,
            'approved',
            ['level' => $approval->level, 'comments' => $request->input('comments', '')]
        );

        return response()->json(['message' => 'Approved']);
    }

    public function returnWithQuery(Request $request, Approval $approval): JsonResponse
    {
        $request->validate(['comments' => 'required|string']);
        $this->requirePermission('approvals', 'edit');
        $this->ensureAssigned($approval);
        $this->approvals->returnWithQuery($approval, $request->comments);

        $this->actLog->log(
            $approval->entity_type,
            $approval->entity_id,
            'returned',
            ['level' => $approval->level, 'comments' => $request->comments]
        );

        return response()->json(['message' => 'Returned with query']);
    }

    public function reject(Request $request, Approval $approval): JsonResponse
    {
        $request->validate(['comments' => 'required|string']);
        $this->requirePermission('approvals', 'edit');
        $this->ensureAssigned($approval);
        $this->approvals->reject($approval, $request->comments);

        $this->actLog->log(
            $approval->entity_type,
            $approval->entity_id,
            'rejected',
            ['level' => $approval->level, 'comments' => $request->comments]
        );

        return response()->json(['message' => 'Rejected']);
    }

    public function emailAction(Request $request): JsonResponse
    {
        $request->validate([
            'token'   => 'required|string',
            'action'  => 'required|in:approve,revise',
            'remarks' => 'required_if:action,revise|string',
        ]);

        $record = $this->tokens->validate($request->token);

        if (auth()->id() !== $record->approver_id) {
            return response()->json(['error' => 'This approval is assigned to a different user.'], 403);
        }

        if ($record->action !== $request->action) {
            return response()->json(['error' => 'Token action mismatch.'], 422);
        }

        $approval = $record->approval;

        if ($request->action === 'approve') {
            $this->approvals->approve($approval);
        } else {
            $this->approvals->returnWithQuery($approval, $request->remarks);
        }

        $this->tokens->consume($record);

        return response()->json(['po_id' => $approval->entity_id]);
    }

    /**
     * Get the current user's pending approval for a specific PO.
     * Returns the approval record so the frontend can use its ID for actions.
     */
    public function myApprovalForPo(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $approval = Approval::where('entity_type', 'PO')
            ->where('entity_id', $purchaseOrder->id)
            ->where('assigned_to_user_id', auth()->id())
            ->where('action', 'pending')
            ->first();

        return response()->json($approval);
    }

    /** Approve a PO by PO ID (convenience shortcut for PO detail page). */
    public function approveViaPoId(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $approval = $this->findMyPendingApproval($purchaseOrder);
        $this->approvals->approve($approval, $request->input('comments', ''));
        $this->actLog->log('PO', $purchaseOrder->id, 'approved', [
            'level' => $approval->level, 'comments' => $request->input('comments', '')
        ]);
        return response()->json(['message' => 'Approved']);
    }

    /** Return a PO by PO ID (convenience shortcut for PO detail page). */
    public function returnViaPoId(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $request->validate(['comments' => 'required|string']);
        $approval = $this->findMyPendingApproval($purchaseOrder);
        $this->approvals->returnWithQuery($approval, $request->comments);
        $this->actLog->log('PO', $purchaseOrder->id, 'returned', [
            'level' => $approval->level, 'comments' => $request->comments
        ]);
        return response()->json(['message' => 'Returned with query']);
    }

    /** Reject a PO by PO ID (convenience shortcut for PO detail page). */
    public function rejectViaPoId(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $request->validate(['comments' => 'required|string']);
        $approval = $this->findMyPendingApproval($purchaseOrder);
        $this->approvals->reject($approval, $request->comments);
        $this->actLog->log('PO', $purchaseOrder->id, 'rejected', [
            'level' => $approval->level, 'comments' => $request->comments
        ]);
        return response()->json(['message' => 'Rejected']);
    }

    /** Find the current user's pending approval for a PO, or abort 403. */
    private function findMyPendingApproval(PurchaseOrder $purchaseOrder): Approval
    {
        $approval = Approval::where('entity_type', 'PO')
            ->where('entity_id', $purchaseOrder->id)
            ->where('assigned_to_user_id', auth()->id())
            ->where('action', 'pending')
            ->first();

        abort_if(!$approval, 403, 'No pending approval assigned to you for this PO.');
        return $approval;
    }

    /**
     * Verify the current user is assigned to this approval AND
     * that the approval's entity belongs to the current tenant.
     */
    private function ensureAssigned(Approval $approval): void
    {
        abort_if($approval->assigned_to_user_id !== auth()->id(), 403);
        abort_if($approval->action !== 'pending', 422);

        // Cross-tenant isolation guard
        $tenantId = app('currentTenant')->id;
        $allowed  = match($approval->entity_type) {
            'PO'      => PurchaseOrder::where('id', $approval->entity_id)
                             ->where('tenant_id', $tenantId)->exists(),
            'PR'      => PurchaseRequisition::where('id', $approval->entity_id)
                             ->where('tenant_id', $tenantId)->exists(),
            'INVOICE' => Invoice::where('id', $approval->entity_id)
                             ->where('tenant_id', $tenantId)->exists(),
            default   => false,
        };
        abort_if(!$allowed, 403, 'Cross-tenant approval access denied.');
    }
}
