<?php

namespace App\Mail;

use App\Models\PurchaseRequisition;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PrStatusUpdateMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public PurchaseRequisition $pr,
        public string $updateMessage,
        public User $sentBy,
        public array $ccEmails = []
    ) {}

    public function envelope(): Envelope
    {
        $prNum = $this->pr->pr_number ?? ("PR #" . $this->pr->id);
        $subject = "[PR Status Update] {$prNum} - {$this->pr->title}";

        $envelope = new Envelope(subject: $subject);

        if (!empty($this->ccEmails)) {
            $envelope->cc($this->ccEmails);
        }

        return $envelope;
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.pr-status-update',
        );
    }
}
