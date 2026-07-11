<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use Barryvdh\Snappy\Facades\SnappyPdf;
use Barryvdh\DomPDF\Facade\Pdf as DomPdf;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;

class PdfService
{
    public static ?string $lastEngineUsed = null;

    public static function makePoPdf(PurchaseOrder $po): string
    {
        $po->loadMissing([
            'items.product', 'vendor', 'vendorAddress',
            'costCenter.department', 'costCenter.project', 'costCenter.location',
            'approvals.assignedTo', 'billToLocation', 'shipToLocation',
            'tenant', 'creator', 'approver',
        ]);

        return static::generate('pdf.purchase-order', ['po' => $po]);
    }

    public static function makePrPdf($pr): string
    {
        $pr->loadMissing([
            'items', 'costCenter', 'project', 'location', 'requestedBy', 'tenant',
        ]);

        return static::generate('pdf.purchase-requisition', ['pr' => $pr]);
    }

    private static function generate(string $view, array $data): string
    {
        try {
            $binary = config('snappy.pdf.binary', '/usr/bin/wkhtmltopdf');

            if (static::binaryExists($binary)) {
                return static::generateWithSnappy($view, $data);
            }

            Log::info('[PdfService] wkhtmltopdf binary not found at "' . $binary . '", using DomPDF fallback.');
        } catch (\Throwable $e) {
            Log::warning('[PdfService] wkhtmltopdf failed, falling back to DomPDF.', ['error' => $e->getMessage()]);
        }

        return static::generateWithDomPdf($view, $data);
    }

    /**
     * wkhtmltopdf — zero CLI header tricks.
     * The repeating "PO No" header is a <thead> inside a full-page wrapper
     * table in the blade. <thead> with display:table-header-group repeats
     * on every page natively in every wkhtmltopdf version.
     */
    private static function generateWithSnappy(string $view, array $data): string
    {
        $pdf = SnappyPdf::loadView($view, $data)
            ->setOption('margin-top', 10)
            ->setOption('margin-right', 13)
            ->setOption('margin-bottom', 12)
            ->setOption('margin-left', 13)
            ->setOption('no-outline', true)
            ->setOption('print-media-type', true)
            ->setOption('disable-smart-shrinking', true)
            ->setOption('enable-local-file-access', true)
            ->setOption('encoding', 'UTF-8');

        self::$lastEngineUsed = 'wkhtmltopdf';
        return $pdf->output();
    }

    private static function generateWithDomPdf(string $view, array $data): string
    {
        self::$lastEngineUsed = 'dompdf';
        $data['is_dompdf'] = true;
        return DomPdf::loadView($view, $data)
            ->setPaper('a4')
            ->output();
    }

    private static function binaryExists(string $path): bool
    {
        if (PHP_OS_FAMILY === 'Windows') {
            exec('where "' . addslashes($path) . '" 2>NUL', $out, $code);
            return $code === 0;
        }

        exec('test -x ' . escapeshellarg($path) . ' 2>/dev/null', $out, $code);
        return $code === 0;
    }
}
