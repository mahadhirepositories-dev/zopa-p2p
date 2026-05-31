<?php

namespace App\Mail;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Mail\Mailables\Attachment;

/**
 * Builds the PDF attachment array for a PR/PO mailable.
 *
 * Relations are (re)loaded defensively so this works even when the mailable
 * was serialized onto a queue (where eager-loaded relations are dropped).
 */
class DocumentPdf
{
    /** @return array<int, Attachment> */
    public static function for(string $entityType, object $entity): array
    {
        try {
            if ($entityType === 'PO') {
                $entity->loadMissing([
                    'items.product', 'vendor', 'vendorAddress',
                    'costCenter.department', 'costCenter.project', 'costCenter.location',
                    'approvals.assignedTo', 'billToLocation', 'shipToLocation', 'tenant',
                ]);
                $pdf  = Pdf::loadView('pdf.purchase-order', ['po' => $entity])->setPaper('a4');
                $name = 'PO-' . ($entity->po_number ?: $entity->id) . '.pdf';
                return [self::attachment($pdf, $name)];
            }

            if ($entityType === 'PR') {
                $entity->loadMissing([
                    'items', 'costCenter', 'project', 'location', 'requestedBy', 'tenant',
                ]);
                $pdf  = Pdf::loadView('pdf.purchase-requisition', ['pr' => $entity])->setPaper('a4');
                $name = 'PR-' . ($entity->pr_number ?: $entity->id) . '.pdf';
                return [self::attachment($pdf, $name)];
            }
        } catch (\Throwable $e) {
            // A PDF failure must never block the notification email.
            report($e);
        }

        return [];
    }

    private static function attachment($pdf, string $name): Attachment
    {
        return Attachment::fromData(fn () => $pdf->output(), $name)
            ->withMime('application/pdf');
    }
}
