<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Tenant;
use App\Models\Vendor;
use App\Models\Product;
use App\Models\CostCenter;
use App\Models\User;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;
use App\Models\PurchaseOrder;
use App\Models\PoItem;

$tenant = Tenant::where('code', 'ACME')->first();
$vendor = Vendor::where('tenant_id', $tenant->id)->first();
$product = Product::where('tenant_id', $tenant->id)->first();
$cc = CostCenter::where('tenant_id', $tenant->id)->first();
$user = User::where('email', 'cbuyer@acmetest.com')->first();

if (!$tenant || !$vendor || !$product || !$cc || !$user) { 
    echo 'Missing data'; 
    exit; 
}

$pr = PurchaseRequisition::create([
    'tenant_id' => $tenant->id,
    'pr_number' => 'PR-002',
    'status' => 'converted',
    'created_by' => $user->id,
    'requested_by' => $user->id,
    'submitted_at' => now(),
    'converted_at' => now(),
    'title' => 'Test PR for Document Upload',
    'pr_ref' => 'REF-002',
    'estimated_amount' => 118,
    'cost_center_id' => $cc->id,
]);

PrItem::create([
    'pr_id' => $pr->id,
    'product_id' => $product->id,
    'sno' => 1,
    'description' => 'Test product',
    'quantity' => 1,
    'estimated_net_rate' => 100,
    'estimated_gst_rate' => 18,
    'estimated_total' => 118,
]);

$po = PurchaseOrder::create([
    'tenant_id' => $tenant->id,
    'vendor_id' => $vendor->id,
    'pr_id' => $pr->id,
    'po_number' => 'PO-002',
    'status' => 'draft',
    'created_by' => $user->id,
    'created_by_role' => 'client_buyer',
    'po_date' => now(),
    'net_total' => 100,
    'tax_amount' => 18,
    'grand_total' => 118,
    'cost_center_id' => $cc->id,
]);

PoItem::create([
    'po_id' => $po->id,
    'product_id' => $product->id,
    'sno' => 1,
    'description' => 'Test product',
    'qty' => 1,
    'net_rate' => 100,
    'gst_rate' => 18,
    'gross_rate' => 118,
    'amount' => 118,
]);

echo 'Seeded PO: ' . $po->po_number;
