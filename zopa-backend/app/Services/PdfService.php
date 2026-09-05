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
            'tenant.locations', 'creator', 'approver',
        ]);

        // PO PDFs use DomPDF directly — the server's wkhtmltopdf is the
        // unpatched-Qt build, on which BOTH --header-* and <thead>/position:fixed
        // repetition are broken, so repeating the PO number on every page is
        // impossible there. DomPDF reliably repeats <thead> and position:fixed.
        return static::generateWithDomPdf('pdf.purchase-order', ['po' => $po]);
    }

    public static function makePrPdf($pr): string
    {
        $pr->loadMissing([
            'items', 'costCenter', 'project', 'location', 'requestedBy', 'tenant',
        ]);

        return static::generate('pdf.purchase-requisition', ['pr' => $pr]);
    }

    public static function makeVendorPdf($vendor): string
    {
        $vendor->loadMissing([
            'tenant', 'category', 'subcategory',
            'vendorCategories.category', 'vendorCategories.subcategory',
            'addresses', 'documents', 'purchaseOrders',
        ]);

        return static::generateWithDomPdf('pdf.vendor', ['vendor' => $vendor]);
    }

    public static function makeGrnPdf(\App\Models\Grn $grn): string
    {
        $grn->loadMissing([
            'items.poItem.product',
            'purchaseOrder.vendor',
            'purchaseOrder.tenant',
            'purchaseOrder.billToLocation',
            'purchaseOrder.shipToLocation',
            'receivedBy',
            'attachments',
        ]);

        return static::generateWithDomPdf('pdf.grn', ['grn' => $grn]);
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
     * Detects patched vs unpatched Qt so the controller can report it in the
     * X-Pdf-Qt response header for diagnosis. The repeating "PO No" header is
     * handled inside the blade template (position:fixed running header) which
     * works on both wkhtmltopdf (patched AND unpatched) and DomPDF.
     */
    private static function generateWithSnappy(string $view, array $data, string $binary): string
    {
        // Detect patched vs unpatched Qt from the version string (memoized).
        if (self::$patchedQt === null) {
            $version = @shell_exec(escapeshellarg($binary) . ' --version 2>&1');
            self::$patchedQt = stripos((string) $version, 'patched') !== false;
        }

        $pdf = SnappyPdf::loadView($view, $data);

        self::$lastEngineUsed = 'wkhtmltopdf' . (self::$patchedQt ? ' (patched)' : ' (unpatched)');
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
