<?php

namespace App\Mail;

use App\Support\DocumentPresenter;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to the VENDOR when a Purchase Order is issued (released) to them.
 *
 * Carries the PO summary (header + line items) in the body and the full
 * PO PDF — including terms & conditions — as an attachment.
 */
class PurchaseOrderIssuedMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $docTitle;
    public string $docNumber;
    /** @var array<string,string> */
    public array $headerRows;
    /** @var array<int,array<string,mixed>> */
    public array $items;
    public string $vendorName;
    public string $buyerOrg;

    public function __construct(public object $po)
    {
        [$this->docTitle, $this->docNumber, $this->headerRows, $this->items]
            = DocumentPresenter::present($po, 'PO');

        $this->vendorName = optional($po->vendor)->name ?? 'Vendor';
        $this->buyerOrg   = optional($po->tenant)->name ?? 'ZOPA Procurement';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Purchase Order {$this->docNumber} from {$this->buyerOrg}",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.po-issued');
    }

    public function attachments(): array
    {
        return DocumentPdf::for('PO', $this->po);
    }
}
