<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$grn = App\Models\Grn::find(1);
$attachment = App\Models\GrnAttachment::find(1);

if (!$grn || !$attachment) {
    echo "Not found";
    exit;
}

echo 'grn id: ' . $grn->id . ', tenant: ' . $grn->tenant_id . "\n";
echo 'attachment grn id: ' . $attachment->grn_id . "\n";
$path = storage_path('app/' . $attachment->file_path);
echo 'path: ' . $path . "\n";
echo 'exists: ' . (file_exists($path) ? 'yes' : 'no') . "\n";
