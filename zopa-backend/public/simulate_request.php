<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Tenant;
use Illuminate\Http\Request;

try {
    $user = User::where('name', 'like', '%Dinesh%')->first();
    if (!$user) {
        $user = User::first();
    }
    echo "Simulating request for user: {$user->name} ({$user->email})\n";

    $tenant = Tenant::where('name', 'like', '%Vihara%')->first();
    if (!$tenant) {
        $tenant = Tenant::first();
    }
    echo "Tenant: {$tenant->name} (ID: {$tenant->id})\n";

    // Create a mock POST request
    $request = Request::create('/api/products', 'POST', [
        'name'            => 'Bed Side Unit - Wired/6M Germ-inhibiting membrane keypad with Nurse',
        'description'     => 'Bed Side Unit - Wired/6M Germ-inhibiting membrane keypad with Nurse Call, Code Blue, Housekeeping, and Extra Support',
        'category_id'     => 85,
        'subcategory_id'  => 86,
        'unit'            => 'Nos',
        'warranty_months' => 3,
        'net_rate'        => 0,
        'gst_rate'        => 18,
        'hsn_code'        => '9018',
        'code'            => 'ZOPA003',
    ]);

    // Set headers
    $request->headers->set('Accept', 'application/json');
    $request->headers->set('X-Tenant-ID', $tenant->id);

    // Login user
    auth()->login($user);

    // Run the request through the router/kernel
    $response = $kernel->handle($request);

    echo "Response status code: " . $response->getStatusCode() . "\n";
    echo "Response body:\n" . $response->getContent() . "\n";

} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
