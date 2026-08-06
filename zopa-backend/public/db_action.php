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
        $old = $po->payment_terms_json;
        $po->payment_terms_json = [
            [
                'stage' => 'Delivery',
                'percentage' => 100,
                'credit_days' => 30
            ]
        ];
        $po->save();
        echo "Successfully updated payment terms for $poNum!\n";
        echo "Old terms: " . json_encode($old) . "\n";
        echo "New terms: " . json_encode($po->payment_terms_json) . "\n";
    } else {
        echo "PO not found: $poNum\n";
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
