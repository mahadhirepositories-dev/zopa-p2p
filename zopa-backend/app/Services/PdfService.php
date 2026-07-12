<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use Barryvdh\Snappy\Facades\SnappyPdf;
use Barryvdh\DomPDF\Facade\Pdf as DomPdf;
use Illuminate\Support\Facades\Log;

class PdfService
{
    public static ?string $lastEngineUsed = null;
    private static ?bool $patchedQt = null;

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
                return static::generateWithSnappy($view, $data, $binary);
            }

            Log::info('[PdfService] wkhtmltopdf binary not found at "' . $binary . '", using DomPDF fallback.');
        } catch (\Throwable $e) {
            Log::warning('[PdfService] wkhtmltopdf failed, falling back to DomPDF.', ['error' => $e->getMessage()]);
        }

        return static::generateWithDomPdf($view, $data);
    }

    /**
     * wkhtmltopdf.
     *
     * Patched-Qt builds support --header-right natively and repeat it on every
     * page — this is the most reliable repeating-header mechanism and does NOT
     * depend on the blade template being re-cached (it's injected here in PHP).
     *
     * Unpatched-Qt builds ignore --header-*; for those we fall back to the
     * position:fixed running header rendered inside the blade template.
     */
    private static function generateWithSnappy(string $view, array $data, string $binary): string
    {
        // Detect patched vs unpatched Qt from the version string (memoized).
        if (self::$patchedQt === null) {
            $version = @shell_exec(escapeshellarg($binary) . ' --version 2>&1');
            self::$patchedQt = stripos((string) $version, 'patched') !== false;
        }
        $patched = self::$patchedQt;

        // Tell the blade whether to render its own fixed header (avoid duplicates
        // when the native header is used).
        $data['native_header'] = $patched;

        $pdf = SnappyPdf::loadView($view, $data);

        if ($patched && isset($data['po'])) {
            $poNo = $data['po']->po_number ?? 'DRAFT';
            $pdf->setOption('header-right', 'PO No: ' . $poNo);
            $pdf->setOption('margin-top', '16');
            $pdf->setOption('header-spacing', '4');
        }

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
