<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->handle(Illuminate\Http\Request::capture());

use Illuminate\Support\Facades\DB;

$tenants = DB::table('tenants')->get(['id', 'name', 'code', 'po_prefix', 'po_starting_series', 'pr_prefix', 'pr_starting_series']);
echo "TENANTS:\n";
foreach ($tenants as $t) {
    echo "ID: {$t->id} | Code: {$t->code} | Name: {$t->name} | PO Prefix: {$t->po_prefix} | PO Start: {$t->po_starting_series} | PR Prefix: {$t->pr_prefix} | PR Start: {$t->pr_starting_series}\n";
}

$pos = DB::table('purchase_orders')->select('id', 'tenant_id', 'po_number', 'status', 'created_at')->orderBy('id', 'desc')->get();
echo "\nPURCHASE ORDERS:\n";
foreach ($pos as $p) {
    echo "ID: {$p->id} | Tenant ID: {$p->tenant_id} | PO Number: {$p->po_number} | Status: {$p->status} | Date: {$p->created_at}\n";
}
