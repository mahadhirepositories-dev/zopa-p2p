<?php

namespace App\Mail;

use App\Models\PurchaseOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class GrnNudgeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public PurchaseOrder $po,
        public string $deliveryStatus,
        public ?string $notes = null
    ) {
        $this->po->loadMissing(['vendor', 'costCenter', 'tenant']);
    }

    public function envelope(): Envelope
    {
        $statusFormatted = ucwords(str_replace('_', ' ', $this->deliveryStatus));
        $poNum = $this->po->po_number ?? ('PO #' . $this->po->id);
        return new Envelope(
            subject: "Delivery Alert: {$poNum} is {$statusFormatted} - Please Record GRN",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.grn-nudge');
    }

    public function attachments(): array
    {
        return [];
    }
}
