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
            'margin-top'    => '10',
            'margin-right'  => '13',
            'margin-bottom' => '15',
            'margin-left'   => '13',

            // ── No header (unpatched Qt — header-html/header-right not supported) ──

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
