<?php

namespace App\Mail;

use App\Support\DocumentPresenter;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to the document's source (PR requester / PO creator) when their
 * document is approved, rejected, or returned for revision. Includes the
 * line-item breakdown, reviewer comments, and a PDF attachment.
 */
class DocumentStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $docTitle;
    public string $docNumber;
    public string $statusLabel;
    /** @var array<string,string> */
    public array $headerRows;
    /** @var array<int,array<string,mixed>> */
    public array $items;

    public function __construct(
        public string $entityType,   // 'PO' | 'PR'
        public object $entity,
        public string $event,        // 'approved' | 'rejected' | 'returned'
        public string $comments = '',
    ) {
        [$this->docTitle, $this->docNumber, $this->headerRows, $this->items]
            = DocumentPresenter::present($entity, $entityType);

        $this->statusLabel = match ($event) {
            'approved' => 'Approved',
            'rejected' => 'Rejected',
            'returned' => 'Returned for Revision',
            'needs_clarification' => 'Needs Clarification',
            default    => ucfirst($event),
        };
    }

    public function envelope(): Envelope
    {
        $subject = $this->event === 'needs_clarification'
            ? "Clarification Requested for {$this->docTitle} {$this->docNumber}"
            : "{$this->docTitle} {$this->docNumber} has been {$this->statusLabel}";

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.document-status');
    }

    public function attachments(): array
    {
        return DocumentPdf::for($this->entityType, $this->entity);
    }
}
