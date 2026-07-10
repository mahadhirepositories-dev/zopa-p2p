<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Snappy PDF Configuration — ZOPA P2P
    |--------------------------------------------------------------------------
    |
    | wkhtmltopdf binary path:
    |   Linux production   → /usr/bin/wkhtmltopdf  (apt install wkhtmltopdf)
    |   Windows local dev  → e.g. C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe
    |
    | Set WKHTML_PDF_BINARY in your .env to override.
    |
    */

    'pdf' => [
        'enabled' => true,
        'binary'  => env('WKHTML_PDF_BINARY', '/usr/bin/wkhtmltopdf'),
        'timeout' => 60,
        'options' => [
            // ── Paper ──────────────────────────────────────────────
            'page-size'   => 'A4',
            'orientation' => 'Portrait',
            'encoding'    => 'UTF-8',
            'dpi'         => 150,

            // ── Margins (mm) ───────────────────────────────────────
            // Top margin is larger to give the running header room.
            'margin-top'    => '22',
            'margin-right'  => '13',
            'margin-bottom' => '15',
            'margin-left'   => '13',

            // ── Header ─────────────────────────────────────────────
            // Header HTML is injected per-call (not set globally here).
            // 'header-html' => ...,
            'header-spacing' => '4',   // mm between header bottom and content

            // ── Rendering ──────────────────────────────────────────
            'no-outline'              => true,
            'print-media-type'        => true,
            'disable-smart-shrinking' => true,
            'enable-local-file-access'=> true,

            // ── Misc ───────────────────────────────────────────────
            'quiet' => true,
        ],
        'env' => [],
    ],

    'image' => [
        'enabled' => true,
        'binary'  => env('WKHTML_IMG_BINARY', '/usr/bin/wkhtmltoimage'),
        'timeout' => 30,
        'options' => [],
        'env'     => [],
    ],

];
