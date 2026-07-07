<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pos = App\Models\PurchaseOrder::pluck('po_number')->toArray();
echo "Available PO numbers:\n";
print_r($pos);
