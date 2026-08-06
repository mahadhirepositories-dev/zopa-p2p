<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Product;
use App\Models\Tenant;

try {
    $code = 'ZOPA003';
    echo "Checking code: $code\n";
    $products = Product::where('code', $code)->get();
    echo "Total matching products found in database: " . $products->count() . "\n";
    foreach ($products as $p) {
        $tenantName = optional(Tenant::find($p->tenant_id))->name ?? "Tenant #{$p->tenant_id}";
        echo " - Product ID: {$p->id} | Name: {$p->name} | Tenant: {$tenantName} (ID: {$p->tenant_id})\n";
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
