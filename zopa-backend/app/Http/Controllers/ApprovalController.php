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
