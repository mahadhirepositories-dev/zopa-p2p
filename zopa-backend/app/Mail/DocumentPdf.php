<?php

namespace App\Mail;

use App\Services\PdfService;
use Illuminate\Mail\Mailables\Attachment;

/**
 * Builds the PDF attachment array for a PR/PO mailable.
 *
 * Relations are (re)loaded defensively so this works even when the mailable
 * was serialized onto a queue (where eager-loaded relations are dropped).
 *
 * PDF generation delegates to PdfService which uses wkhtmltopdf as the
 * primary engine with DomPDF as an automatic fallback.
 */
class DocumentPdf
{
    /** @return array<int, Attachment> */
    public static function for(string $entityType, object $entity): array
    {
        try {
            if ($entityType === 'PO') {
                $bytes = PdfService::makePoPdf($entity);
                $name  = 'PO-' . str_replace(['/', '\\'], '-', (string) ($entity->po_number ?: $entity->id)) . '.pdf';
                return [self::attachment($bytes, $name)];
            }

            if ($entityType === 'PR') {
                $bytes = PdfService::makePrPdf($entity);
                $name  = 'PR-' . str_replace(['/', '\\'], '-', (string) ($entity->pr_number ?: $entity->id)) . '.pdf';
                return [self::attachment($bytes, $name)];
            }
        } catch (\Throwable $e) {
            // A PDF failure must never block the notification email.
            report($e);
        }

        return [];
    }

    private static function attachment(string $bytes, string $name): Attachment
    {
        return Attachment::fromData(fn () => $bytes, $name)
            ->withMime('application/pdf');
    }
}
