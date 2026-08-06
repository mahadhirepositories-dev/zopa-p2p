<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->handle(Illuminate\Http\Request::capture());

use Illuminate\Support\Facades\DB;

$updated = DB::statement("
    UPDATE po_items 
    JOIN products ON po_items.product_id = products.id 
    SET 
      po_items.product_name = products.name,
      po_items.product_code = COALESCE(po_items.product_code, products.code),
      po_items.hsn_code = COALESCE(po_items.hsn_code, products.hsn_code)
    WHERE po_items.product_id IS NOT NULL
");

echo "Successfully backfilled product names and codes on po_items!";
