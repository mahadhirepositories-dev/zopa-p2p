<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\UserTenantRole;
use App\Models\Tenant;

try {
    $user = User::where('name', 'like', '%Dinesh%')->first();
    if (!$user) {
        $user = User::first();
    }
    echo "User: {$user->name} | Email: {$user->email} | ID: {$user->id}\n";

    $roles = UserTenantRole::where('user_id', $user->id)->get();
    echo "Total tenant roles found: " . $roles->count() . "\n";
    foreach ($roles as $r) {
        $tenantName = optional(Tenant::find($r->tenant_id))->name ?? "Tenant #{$r->tenant_id}";
        echo " - Tenant: $tenantName (ID: {$r->tenant_id}) | Role: {$r->role} | Is Active: " . ($r->is_active ? 'YES' : 'NO') . "\n";
    }

    echo "isSuperAdmin() returns: " . ($user->isSuperAdmin() ? 'TRUE' : 'FALSE') . "\n";

} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
