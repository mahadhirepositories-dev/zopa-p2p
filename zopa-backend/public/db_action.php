<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Tenant;
use App\Models\UserTenantRole;
use App\Models\RolePermission;

try {
    $user = User::where('name', 'like', '%Dinesh%')->first();
    if (!$user) {
        echo "No user named Dinesh found.\n";
        $user = User::first();
    }
    echo "User: {$user->name} | Email: {$user->email} | ID: {$user->id} | Is ZOPA Staff: " . ($user->is_zopa_staff ? 'YES' : 'NO') . "\n";

    $tenant = Tenant::where('name', 'like', '%Vihara%')->first();
    if ($tenant) {
        echo "Tenant: {$tenant->name} | ID: {$tenant->id}\n";
        // User tenant role
        $role = UserTenantRole::where('user_id', $user->id)
            ->where('tenant_id', $tenant->id)
            ->first();
        if ($role) {
            echo "Role in Tenant: {$role->role} | Is Active: " . ($role->is_active ? 'YES' : 'NO') . "\n";
            // Let's check permissions for this role in the tenant
            $perms = RolePermission::where('tenant_id', $tenant->id)
                ->where('role', $role->role)
                ->get();
            echo "Permissions count: " . $perms->count() . "\n";
            foreach ($perms as $p) {
                echo " - Module: {$p->module} | Actions: " . json_encode($p->permissions) . "\n";
            }
        } else {
            echo "User has no role in this tenant.\n";
        }
    } else {
        echo "Vihara tenant not found.\n";
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
