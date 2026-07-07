<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pr = \App\Models\PurchaseRequisition::where('title', 'TEST 1 PR')->first();
if ($pr) {
    echo json_encode($pr->items()->get()->toArray());
} else {
    echo "PR not found\n";
}
