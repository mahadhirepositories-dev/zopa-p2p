<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

DB::statement("ALTER TABLE `user_tenant_roles` MODIFY COLUMN `role` ENUM('zopa_super_admin', 'zopa_buyer', 'zopa_approver_l1', 'zopa_approver_l2', 'zopa_approver_l3', 'zopa_pr', 'zopa_grn', 'client_admin', 'client_buyer', 'client_approver_l1', 'client_approver_l2', 'client_approver_l3', 'client_pr', 'client_grn') NOT NULL");

echo "Success\n";
