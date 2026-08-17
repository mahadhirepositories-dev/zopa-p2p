<?php

namespace App\Mail;

use App\Models\Approval;
use App\Services\TokenService;
use App\Support\DocumentPresenter;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to an assigned approver when a PR or PO reaches their approval level.
 *
 * Contains the full line-item breakdown in the body, a PDF attachment, and
 * one-click Approve / Reject links that hit the PUBLIC (token-authenticated)
 * email-action endpoints — no login required.
 */
class ApprovalRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $approveUrl;
    public string $rejectUrl;
    public string $approverName;
    public string $docTitle;
    public string $docNumber;
    /** @var array<string,string> */
    public array $headerRows;
    /** @var array<int,array<string,mixed>> */
    public array $items;
    /** Buyer/requester who raised the document — CC'd so they see the routing. @var array<int,string> */
    public array $ccList = [];

    public function __construct(
        public Approval $approval,
        public string $entityType,   // 'PO' | 'PR'
        public object $entity,       // PurchaseOrder | PurchaseRequisition
    ) {
        $tokens = app(TokenService::class);

        // Distinct single-use tokens per action; the URL path declares the action.
        $baseUrl = config('app.url');
        if (str_starts_with($baseUrl, 'https://') || request()->secure()) {
            $this->approveUrl = secure_url('/api/email/approval/' . $tokens->generate($approval, 'approve') . '/approve');
            $this->rejectUrl  = secure_url('/api/email/approval/' . $tokens->generate($approval, 'reject')  . '/reject');
        } else {
            $this->approveUrl = url('/api/email/approval/' . $tokens->generate($approval, 'approve') . '/approve');
            $this->rejectUrl  = url('/api/email/approval/' . $tokens->generate($approval, 'reject')  . '/reject');
        }

        $this->approverName = $approval->assignedTo?->name ?? 'Approver';

        // CC the person who raised the document (PO creator / PR requester) so the
        // buyer is kept in the loop — but not if they are the approver themselves.
        if ($entityType === 'PO') {
            $entity->loadMissing('creator');
            $raiserEmail = optional($entity->creator)->email;
        } else {
            $entity->loadMissing('requestedBy');
            $raiserEmail = optional($entity->requestedBy)->email;
        }
        $approverEmail = $approval->assignedTo?->email;
        $this->ccList  = ($raiserEmail && $raiserEmail !== $approverEmail) ? [$raiserEmail] : [];

        [$this->docTitle, $this->docNumber, $this->headerRows, $this->items]
            = DocumentPresenter::present($entity, $entityType);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Action Required: {$this->docTitle} {$this->docNumber} — Level {$this->approval->level} Approval",
            cc: $this->ccList,
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.approval-request');
    }

    public function attachments(): array
    {
        return DocumentPdf::for($this->entityType, $this->entity);
    }
}
