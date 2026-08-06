<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\PurchaseOrder;

try {
    $pos = PurchaseOrder::whereNotNull('payment_terms_json')->get();
    echo "Inspecting POs with payment terms:\n";
    $count = 0;
    foreach ($pos as $po) {
        $terms = $po->payment_terms_json;
        if (is_array($terms)) {
            foreach ($terms as $t) {
                if (isset($t['stage']) && stripos($t['stage'], 'credit') !== false) {
                    echo "PO: {$po->po_number} | Terms: " . json_encode($terms) . "\n";
                    $count++;
                    if ($count >= 5) break 2;
                }
            }
        }
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
