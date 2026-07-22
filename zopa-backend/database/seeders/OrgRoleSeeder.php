<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class OrgRoleSeeder extends Seeder
{
    public function run(): void
    {
        $now = now()->toDateTimeString();
        
        $roles = [
            // ZOPA Roles
            ['slug' => 'zopa_super_admin',    'name' => 'ZOPA Super Admin',     'type' => 'zopa',   'is_system' => 1],
            ['slug' => 'zopa_buyer',          'name' => 'ZOPA Buyer',           'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_pr',             'name' => 'ZOPA PR User',         'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_grn',            'name' => 'ZOPA GRN User',        'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_approver_l1',    'name' => 'ZOPA Approver (L1)',   'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_approver_l2',    'name' => 'ZOPA Approver (L2)',   'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_approver_l3',    'name' => 'ZOPA Approver (L3)',   'type' => 'zopa',   'is_system' => 0],
            
            // Client Roles
            ['slug' => 'client_admin',        'name' => 'Client Admin',         'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_buyer',        'name' => 'Client Buyer',         'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_pr',           'name' => 'Client PR User',       'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_grn',          'name' => 'Client GRN User',      'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_approver_l1',  'name' => 'Client Approver L1',   'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_approver_l2',  'name' => 'Client Approver L2',   'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_approver_l3',  'name' => 'Client Approver L3',   'type' => 'client', 'is_system' => 0],
        ];

        foreach ($roles as $role) {
            DB::table('org_roles')->insertOrIgnore([
                'slug'       => $role['slug'],
                'name'       => $role['name'],
                'type'       => $role['type'],
                'is_system'  => $role['is_system'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
