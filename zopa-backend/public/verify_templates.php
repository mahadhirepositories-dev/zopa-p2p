<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\Admin\EmailTemplatesController;

try {
    $controller = new EmailTemplatesController();
    $response = $controller->index();
    echo "Status code: " . $response->getStatusCode() . "\n";
    $data = json_decode($response->getContent(), true);
    echo "Count: " . count($data) . "\n";
    foreach ($data as $t) {
        echo " - " . $t['key'] . ": " . $t['name'] . "\n";
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
