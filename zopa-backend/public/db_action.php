<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\PurchaseOrder;

try {
    $poNum = 'AV/2026-27/14';
    $po = PurchaseOrder::where('po_number', $poNum)->first();
    if ($po) {
        echo "Found PO ID: {$po->id}\n";
        echo "PO Number: {$po->po_number}\n";
        echo "Payment Terms: " . json_encode($po->payment_terms) . "\n";
        echo "Status: {$po->status}\n";
        echo "Full PO Attributes:\n";
        print_r($po->toArray());
    } else {
        echo "PO not found: $poNum\n";
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
