<?php

namespace App\Mail;

use App\Models\OperationalReport;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OperationalReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $docTitle;
    public string $tenantName;
    public string $buyerName;
    public string $buyerEmail;
    public array $metrics;

    public function __construct(
        public OperationalReport $report,
        public string $pdfBytes,
        public string $recipientName,
        public array $ccList = [],
        public ?string $customMessage = null
    ) {
        $this->docTitle   = $report->title;
        $this->tenantName = $report->tenant?->name ?? 'ZOPA Client Organization';
        $this->buyerName  = $report->creator?->name ?? 'ZOPA Procurement Team';
        $this->buyerEmail = $report->creator?->email ?? 'buyer@zopapro.com';
        $this->metrics    = $report->metrics_data ?? [];
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[Operational Review] " . $this->docTitle,
            cc: $this->ccList,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.operational-report-summary',
            with: [
                'report'         => $this->report,
                'docTitle'       => $this->docTitle,
                'tenantName'     => $this->tenantName,
                'buyerName'      => $this->buyerName,
                'recipientName'  => $this->recipientName,
                'metrics'        => $this->metrics,
                'customMessage'  => $this->customMessage,
            ]
        );
    }

    public function attachments(): array
    {
        $safeTitle = preg_replace('/[^A-Za-z0-9_\-]/', '_', $this->report->title ?: 'Operational_Report');
        $filename  = $safeTitle . '.pdf';

        return [
            Attachment::fromData(fn () => $this->pdfBytes, $filename)
                ->withMime('application/pdf'),
        ];
    }
}
