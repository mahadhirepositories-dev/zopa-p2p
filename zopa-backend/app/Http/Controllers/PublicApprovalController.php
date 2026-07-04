<?php

namespace App\Http\Controllers;

use App\Models\EmailActionToken;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Services\ActivityLogService;
use App\Services\ApprovalService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * One-click approve / reject straight from an approval email — NO login.
 *
 * Security model (capability URL / "magic link"):
 *   - The token is an unguessable HMAC(sha256) value.
 *   - It is single-use (used_at) and expires in 72h.
 *   - It is bound to one approval AND one action; acting consumes ALL of that
 *     approval's outstanding tokens so the sibling link is immediately dead.
 *
 * These routes are deliberately OUTSIDE auth:sanctum and tenant scoping — the
 * token IS the authorization. We hydrate the acting user from the token so all
 * downstream attribution (approved_by, activity log) is correct.
 */
class PublicApprovalController extends Controller
{
    public function __construct(
        private ApprovalService    $approvals,
        private ActivityLogService $actLog,
    ) {}

    /**
     * GET /api/email/approval/{token}/approve — show a confirmation page. Does NOT act.
     *
     * ⚠️ State-changing actions MUST NOT happen on GET. Email security scanners and
     * link prefetchers (Microsoft Defender Safe Links, Gmail, Mimecast, Barracuda,
     * antivirus, chat unfurlers) automatically issue a GET to every URL in an email
     * to check for malware. When approve acted on GET, that automated fetch silently
     * approved the document the instant the email was delivered — the "auto-approve"
     * bug. Reject was always two-step (GET form → POST) which is why only approve was
     * ever auto-triggered. Approve now mirrors reject: the human must click Confirm,
     * which POSTs. Prefetchers do not submit POST forms, so they cannot approve.
     */
    public function showApprove(string $token): View
    {
        $record = $this->lookup($token, 'approve');
        if (!$record instanceof EmailActionToken) {
            return $record; // already a rendered error/info page
        }

        return view('emails.public.approve-form', [
            'token'    => $token,
            'docLabel' => $this->docLabel($record->approval),
        ]);
    }

    /** POST /api/email/approval/{token}/approve — perform the approval. */
    public function approve(string $token): View
    {
        $record = $this->lookup($token, 'approve');
        if (!$record instanceof EmailActionToken) {
            return $record; // already a rendered error/info page
        }

        $approval = $record->approval;
        Auth::setUser($record->approver);

        $this->approvals->approve($approval);
        $this->finalize($record, $approval, 'approved');

        return $this->result(true, 'Approved', $this->docLabel($approval) . ' has been approved successfully.', '#16a34a');
    }

    /** GET /api/email/approval/{token}/reject — show the reason form */
    public function showReject(string $token): View
    {
        $record = $this->lookup($token, 'reject');
        if (!$record instanceof EmailActionToken) {
            return $record;
        }

        return view('emails.public.reject-form', [
            'token'    => $token,
            'docLabel' => $this->docLabel($record->approval),
            'error'    => null,
        ]);
    }

    /** POST /api/email/approval/{token}/reject — perform the rejection */
    public function reject(Request $request, string $token): View
    {
        $record = $this->lookup($token, 'reject');
        if (!$record instanceof EmailActionToken) {
            return $record;
        }

        // Manual validation so a browser form re-renders (instead of a 422 JSON
        // response, which is what automatic validation would return on API routes).
        $remarks = trim((string) $request->input('remarks', ''));
        if ($remarks === '') {
            return view('emails.public.reject-form', [
                'token'    => $token,
                'docLabel' => $this->docLabel($record->approval),
                'error'    => 'Please provide a reason for rejection.',
            ]);
        }
        $remarks = mb_substr($remarks, 0, 1000);

        $approval = $record->approval;
        Auth::setUser($record->approver);

        $this->approvals->reject($approval, $remarks);
        $this->finalize($record, $approval, 'rejected', $remarks);

        return $this->result(false, 'Rejected', $this->docLabel($approval) . ' has been rejected.', '#dc2626');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resolve and validate a token for the expected action.
     * Returns the EmailActionToken on success, or a rendered View explaining
     * why the link can't be used (expired / already actioned).
     */
    private function lookup(string $token, string $expectedAction): EmailActionToken|View
    {
        $record = EmailActionToken::with(['approval', 'approver'])
            ->where('token', $token)
            ->first();

        if (!$record || !$record->approver || !$record->approval) {
            return $this->result(false, 'Invalid link', 'This approval link is not valid.', '#64748b');
        }

        if (!is_null($record->used_at) || $record->expires_at->isPast()) {
            return $this->result(false, 'Link expired', 'This approval link has already been used or has expired.', '#64748b');
        }

        if ($record->action !== $expectedAction) {
            return $this->result(false, 'Invalid link', 'This link does not match the requested action.', '#64748b');
        }

        if ($record->approval->action !== 'pending') {
            return $this->result(true, 'Already processed', 'This item has already been actioned by you or another approver.', '#64748b');
        }

        if ($record->approval->assigned_to_user_id !== $record->approver_id) {
            return $this->result(false, 'Invalid link', 'This approval is assigned to a different user.', '#64748b');
        }

        return $record;
    }

    /** Consume all tokens for the approval and log the action against the tenant. */
    private function finalize(EmailActionToken $record, $approval, string $event, string $comments = ''): void
    {
        EmailActionToken::where('approval_id', $approval->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $this->actLog->log(
            $approval->entity_type,
            $approval->entity_id,
            $event,
            ['via' => 'email', 'level' => $approval->level, 'comments' => $comments],
            $this->entityTenantId($approval->entity_type, $approval->entity_id),
        );
    }

    private function entityTenantId(string $type, int $id): ?int
    {
        return match ($type) {
            'PO'      => PurchaseOrder::whereKey($id)->value('tenant_id'),
            'PR'      => PurchaseRequisition::whereKey($id)->value('tenant_id'),
            'INVOICE' => Invoice::whereKey($id)->value('tenant_id'),
            default   => null,
        };
    }

    private function docLabel($approval): string
    {
        return match ($approval->entity_type) {
            'PO'      => 'Purchase Order #' . (PurchaseOrder::whereKey($approval->entity_id)->value('po_number') ?: $approval->entity_id),
            'PR'      => 'Purchase Requisition #' . (PurchaseRequisition::whereKey($approval->entity_id)->value('pr_number') ?: $approval->entity_id),
            'INVOICE' => 'Invoice #' . $approval->entity_id,
            default   => 'Document #' . $approval->entity_id,
        };
    }

    private function result(bool $ok, string $title, string $message, string $color): View
    {
        return view('emails.public.result', compact('ok', 'title', 'message', 'color'));
    }
}
