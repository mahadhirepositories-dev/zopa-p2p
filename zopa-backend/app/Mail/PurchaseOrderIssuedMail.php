<?php

namespace App\Mail;

use App\Support\DocumentPresenter;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

/**
 * Sent to the VENDOR when a Purchase Order is issued (released) to them.
 *
 * Vendor-facing on purpose: it shows who is ordering (client org + GSTIN),
 * where to bill and ship, by when it's needed, the order value, and the line
 * items — NOT internal fields like cost centre (that view is for approvers).
 * The full PO (with T&C) is attached as a PDF.
 */
class PurchaseOrderIssuedMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $docTitle;
    public string $docNumber;
    /** @var array<int,array<string,mixed>> */
    public array $items;
    public string $vendorName;
    public string $buyerOrg;
    /** @var array<string,string> */
    public array $headerRows;
    /** @var array{name:string,lines:array<int,string>}|null */
    public ?array $billTo;
    public ?array $shipTo;
    /** Buyer who raised the PO — CC'd on this vendor communication. @var array<int,string> */
    public array $ccList = [];
    /** Contact person name shown in the vendor email footer */
    public string $contactName;
    /** Contact phone shown in the vendor email footer */
    public string $contactPhone;

    public function __construct(public object $po, array $extraCc = [])
    {
        $po->loadMissing([
            'items.product', 'vendor', 'costCenter', 'tenant',
            'billToLocation', 'shipToLocation', 'creator',
        ]);

        // CC the buyer who raised the PO + any extra CC emails provided at release.
        $this->ccList = array_values(array_unique(array_filter(array_merge(
            [optional($po->creator)->email],
            $extraCc
        ))));

        // DocumentPresenter only supplies the title/number/line-items here; the
        // header rows below are intentionally VENDOR-facing, not the approver view.
        [$this->docTitle, $this->docNumber, , $this->items] = DocumentPresenter::present($po, 'PO');

        $this->vendorName = optional($po->vendor)->name ?? 'Vendor';
        $this->buyerOrg   = optional($po->tenant)->name ?? 'ZOPA Procurement';
        $gstin            = optional($po->tenant)->gstin;

        // Contact person for vendor queries — show the PO creator's name + phone
        $creator              = optional($po->creator);
        $this->contactName    = $creator->name  ?? $this->buyerOrg;
        $this->contactPhone   = $creator->phone ?? '';

        $this->headerRows = [
            'Issued By'   => $this->buyerOrg . ($gstin ? "  ·  GSTIN: {$gstin}" : ''),
            'PO Date'     => $this->fmtDate($po->po_date),
            'Needed By'   => $this->neededBy($po) ?? '—',
            'Valid Till'  => $this->fmtDate($po->po_valid_till),
            'Net Total'   => 'Rs ' . number_format((float) $po->net_total, 2),
            'Tax'         => 'Rs ' . number_format((float) $po->tax_amount, 2),
            'Grand Total' => 'Rs ' . number_format((float) $po->grand_total, 2),
        ];

        $this->billTo = $this->addressBlock($po->billToLocation);
        $this->shipTo = $this->addressBlock($po->shipToLocation) ?: $this->billTo;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Purchase Order {$this->docNumber} from {$this->buyerOrg}",
            cc: $this->ccList,
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

    private function fmtDate($d): string
    {
        return $d ? Carbon::parse($d)->format('d M Y') : '—';
    }

    /** Earliest required-by across line items = the binding delivery deadline. */
    private function neededBy(object $po): ?string
    {
        $dates = collect($po->items ?? [])
            ->pluck('required_by')
            ->filter()
            ->map(fn ($d) => Carbon::parse($d));

        return $dates->isEmpty() ? null : $dates->min()->format('d M Y');
    }

    /**
     * Full address block for a location, excluding State Code.
     * @return array{name:string,lines:array<int,string>}|null
     */
    private function addressBlock($loc): ?array
    {
        if (!$loc) {
            return null;
        }

        $cityState = collect([$loc->city ?? null, $loc->state ?? null])->filter()->implode(', ');
        $line = $cityState;
        if (!empty($loc->pincode)) {
            $line = $line !== '' ? $line . ' - ' . $loc->pincode : (string) $loc->pincode;
        }

        $lines = array_values(array_filter([
            $loc->address ?? null,
            $line ?: null,
            $loc->country ?? null,
            !empty($loc->gstin) ? 'GSTIN: ' . $loc->gstin : null,
        ]));

        return ['name' => $loc->name, 'lines' => $lines];
    }
}
