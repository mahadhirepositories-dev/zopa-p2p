<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$po = App\Models\PurchaseOrder::where('po_number', '2601/02/TOTALHEALTH-PO-2026-0001')->first();
if ($po) {
    $po->po_number = 'TH/2026-27/48';
    $po->save();
    echo "Successfully updated PO number to TH/2026-27/48\n";
} else {
    echo "PO not found\n";
}
