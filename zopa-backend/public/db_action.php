<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Product;

try {
    $id = 534;
    $product = Product::find($id);
    if ($product) {
        $product->delete();
        echo "Deleted product ID: $id (Code: {$product->code})\n";
    } else {
        echo "Product ID $id not found.\n";
    }

    $product2 = Product::where('code', 'ZOPA003')->first();
    if ($product2) {
        $product2->delete();
        echo "Deleted product with code ZOPA003 (ID: {$product2->id})\n";
    } else {
        echo "No other product with code ZOPA003 found.\n";
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
