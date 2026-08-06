<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->handle(Illuminate\Http\Request::capture());

use Illuminate\Support\Facades\DB;

// 1. Update Tenant 3 (Vihara) po_prefix
DB::table('tenants')
    ->where('id', 3)
    ->update([
        'po_prefix' => '2605/03/VIHARA-PO-2026-',
        'updated_at' => now(),
    ]);

// 2. Update PO #73 po_number to 2605/03/VIHARA-PO-2026-0002
DB::table('purchase_orders')
    ->where('id', 73)
    ->update([
        'po_number' => '2605/03/VIHARA-PO-2026-0002',
        'updated_at' => now(),
    ]);

echo "Successfully updated Tenant 3 PO prefix to '2605/03/VIHARA-PO-2026-' and PO #73 number to '2605/03/VIHARA-PO-2026-0002'!";
