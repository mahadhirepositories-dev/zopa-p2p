<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Product;
use App\Models\Tenant;
use App\Models\Category;

try {
    // 1. Find tenant
    $tenant = Tenant::where('name', 'like', '%Vihara%')->first();
    if (!$tenant) {
        $tenant = Tenant::first();
        echo "Vihara tenant not found, falling back to: {$tenant->name} (ID: {$tenant->id})\n";
    } else {
        echo "Found Tenant: {$tenant->name} (ID: {$tenant->id})\n";
    }

    // 2. Find category
    $category = Category::where('tenant_id', $tenant->id)->where('name', 'like', '%Medical Equipment%')->first();
    $subCategory = Category::where('tenant_id', $tenant->id)->where('name', 'like', '%Patient%')->first();

    $catId = $category ? $category->id : null;
    $subCatId = $subCategory ? $subCategory->id : null;

    echo "Primary Category: " . ($category ? $category->name : 'None') . " (ID: $catId)\n";
    echo "Secondary Category: " . ($subCategory ? $subCategory->name : 'None') . " (ID: $subCatId)\n";

    // 3. Try to dry-run creation in a transaction that we roll back
    \Illuminate\Support\Facades\DB::beginTransaction();

    $product = Product::create([
        'tenant_id' => $tenant->id,
        'code' => 'ZOPA003',
        'name' => 'Bed Side Unit - Wired/6M Germ-inhibiting membrane keypad with Nurse',
        'description' => 'Bed Side Unit - Wired/6M Germ-inhibiting membrane keypad with Nurse Call, Code Blue, Housekeeping, and Extra Support',
        'category_id' => $catId,
        'subcategory_id' => $subCatId,
        'unit' => 'Nos',
        'warranty_months' => 3,
        'net_rate' => 0,
        'gst_rate' => 18,
        'hsn_code' => '9018',
    ]);

    echo "SUCCESS: Product created successfully in transaction. ID = {$product->id}\n";

    \Illuminate\Support\Facades\DB::rollBack();
    echo "Transaction rolled back cleanly.\n";

} catch (\Throwable $e) {
    echo "EXCEPTION THROWN: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo $e->getTraceAsString() . "\n";
    \Illuminate\Support\Facades\DB::rollBack();
}
