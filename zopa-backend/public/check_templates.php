<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\Admin\EmailTemplatesController;
use Illuminate\Http\Request;

try {
    $user = \App\Models\User::where('email', 'webmaster@zopapro.com')->first() ?: \App\Models\User::first();
    if ($user) {
        auth()->login($user);
        echo "Logged in as: " . $user->email . "\n";
    }

    $controller = new EmailTemplatesController();
    $response = $controller->index();
    echo "Status code: " . $response->getStatusCode() . "\n";
    echo "Content:\n" . substr($response->getContent(), 0, 500) . "...\n";
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
