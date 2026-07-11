<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use Barryvdh\Snappy\Facades\SnappyPdf;
use Barryvdh\DomPDF\Facade\Pdf as DomPdf;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;

/**
 * Centralised PDF generation service.
 *
 * Primary engine  : wkhtmltopdf (via barryvdh/laravel-snappy).
 * Fallback engine : DomPDF (via barryvdh/laravel-dompdf).
 *
 * The fallback is triggered automatically when the wkhtmltopdf binary is
 * not found or the snappy call throws. This ensures email notifications
 * (and the download endpoint) never crash even on environments where
 * wkhtmltopdf has not yet been installed.
 */
class PdfService
{
    public static ?string $lastEngineUsed = null;
    // ─────────────────────────────────────────────────────────────────────────
    //  Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate a PO PDF and return the raw bytes.
     *
     * @param  PurchaseOrder $po  Must have all required relations loaded.
     * @return string  Raw PDF binary string.
     */
    public static function makePoPdf(PurchaseOrder $po): string
    {
        // Ensure all relations needed by the blade are present.
        $po->loadMissing([
            'items.product', 'vendor', 'vendorAddress',
            'costCenter.department', 'costCenter.project', 'costCenter.location',
            'approvals.assignedTo', 'billToLocation', 'shipToLocation',
            'tenant', 'creator', 'approver',
        ]);

        $headerHtml = View::make('pdf.po-header', [
            'po_number' => $po->po_number ?? 'DRAFT',
        ])->render();

        return static::generate('pdf.purchase-order', ['po' => $po], $headerHtml);
    }

    /**
     * Generate a PR PDF and return the raw bytes.
     *
     * @param  \App\Models\PurchaseRequisition $pr
     * @return string
     */
    public static function makePrPdf($pr): string
    {
        $pr->loadMissing([
            'items', 'costCenter', 'project', 'location', 'requestedBy', 'tenant',
        ]);

        $headerHtml = View::make('pdf.pr-header', [
            'pr_number' => $pr->pr_number ?? 'DRAFT',
        ])->render();

        return static::generate('pdf.purchase-requisition', ['pr' => $pr], $headerHtml);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Render the given view and convert to PDF.
     * Tries wkhtmltopdf first; falls back to DomPDF if the binary is absent.
     *
     * @param  string  $view        Blade view name.
     * @param  array   $data        View data.
     * @param  string  $headerHtml  Rendered HTML for the repeating page header.
     * @return string  Raw PDF bytes.
     */
    private static function generate(string $view, array $data, string $headerHtml): string
    {
        // ── Try wkhtmltopdf ────────────────────────────────────────────────
        try {
            $binary = config('snappy.pdf.binary', '/usr/bin/wkhtmltopdf');

            // On Windows dev machines the binary may not exist; skip to fallback.
            if (static::binaryExists($binary)) {
                return static::generateWithSnappy($view, $data, $headerHtml);
            }

            Log::info('[PdfService] wkhtmltopdf binary not found at "' . $binary . '", using DomPDF fallback.');
        } catch (\Throwable $e) {
            Log::warning('[PdfService] wkhtmltopdf failed, falling back to DomPDF.', ['error' => $e->getMessage()]);
        }

        // ── Fallback: DomPDF ───────────────────────────────────────────────
        return static::generateWithDomPdf($view, $data);
    }

    /**
     * Generate PDF using wkhtmltopdf via barryvdh/laravel-snappy.
     */
    private static function generateWithSnappy(string $view, array $data, string $headerHtml): string
    {
        // Write the header HTML to a project storage folder to avoid any systemd PrivateTmp / permissions issues on Linux
        $tempDir = storage_path('app/temp_pdf');
        if (!file_exists($tempDir)) {
            @mkdir($tempDir, 0755, true);
        }
        $headerFile = $tempDir . '/zopa_hdr_' . uniqid() . '.html';
        file_put_contents($headerFile, $headerHtml);

        // Convert path to file:// URL on Windows for local file access compatibility
        if (PHP_OS_FAMILY === 'Windows') {
            $headerUrl = 'file:///' . ltrim(str_replace('\\', '/', $headerFile), '/');
        } else {
            $headerUrl = $headerFile;
        }

        try {
            $pdf = SnappyPdf::loadView($view, $data)
                ->setOption('header-html', $headerUrl)
                ->setOption('header-spacing', 2)
                ->setOption('margin-top', 15)
                ->setOption('margin-right', 13)
                ->setOption('margin-bottom', 15)
                ->setOption('margin-left', 13)
                ->setOption('no-outline', true)
                ->setOption('print-media-type', true)
                ->setOption('disable-smart-shrinking', true)
                ->setOption('enable-local-file-access', true)
                ->setOption('encoding', 'UTF-8');

            self::$lastEngineUsed = 'wkhtmltopdf';
            return $pdf->output();
        } finally {
            // Always clean up the temp file.
            if (file_exists($headerFile)) {
                @unlink($headerFile);
            }
        }
    }

    /**
     * Generate PDF using DomPDF (fallback for environments without wkhtmltopdf).
     */
    private static function generateWithDomPdf(string $view, array $data): string
    {
        self::$lastEngineUsed = 'dompdf';
        $data['is_dompdf'] = true;
        return DomPdf::loadView($view, $data)
            ->setPaper('a4')
            ->output();
    }

    /**
     * Check whether a binary exists and is executable on the current OS.
     *
     * is_executable() can return false inside systemd sandboxed PHP-FPM units
     * even when the binary is perfectly accessible via shell. We therefore
     * always confirm with a shell probe as the authoritative check.
     */
    private static function binaryExists(string $path): bool
    {
        if (PHP_OS_FAMILY === 'Windows') {
            exec('where "' . addslashes($path) . '" 2>NUL', $out, $code);
            return $code === 0;
        }

        // Use `test -x` — reliable even inside systemd PrivateTmp / NoNewPrivileges units.
        exec('test -x ' . escapeshellarg($path) . ' 2>/dev/null', $out, $code);
        return $code === 0;
    }
}
