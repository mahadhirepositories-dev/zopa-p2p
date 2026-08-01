<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "All Tenants:\n";
$tenants = \App\Models\Tenant::all();
foreach ($tenants as $t) {
    echo "ID: {$t->id} | Name: {$t->name} | Code: {$t->code}\n";
}

echo "\nAll Draft PRs created today (2026-08-01):\n";
$draftPrs = \App\Models\PurchaseRequisition::where('status', 'draft')
    ->whereDate('created_at', '2026-08-01')
    ->with('tenant:id,name')
    ->get();

echo "Count: " . $draftPrs->count() . "\n";
foreach ($draftPrs as $p) {
    $tenantName = $p->tenant ? $p->tenant->name : 'No Tenant';
    echo "ID: {$p->id} | Tenant: {$tenantName} (#{$p->tenant_id}) | Title: {$p->title} | PR Number: {$p->pr_number} | Created: {$p->created_at}\n";
}
