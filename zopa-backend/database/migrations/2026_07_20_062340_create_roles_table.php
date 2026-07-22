<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('org_roles', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique(); // e.g. 'zopa_buyer' or 'custom_finance'
            $table->string('name'); // e.g. 'ZOPA Buyer' or 'Finance Manager'
            $table->enum('type', ['zopa', 'client'])->default('client'); // which org type it applies to
            $table->boolean('is_system')->default(false); // cannot be deleted if true
            $table->timestamps();
        });

        // Seed default roles so live deployment has all roles immediately
        $now = now()->toDateTimeString();
        $roles = [
            ['slug' => 'zopa_super_admin',    'name' => 'ZOPA Super Admin',     'type' => 'zopa',   'is_system' => 1],
            ['slug' => 'zopa_buyer',          'name' => 'ZOPA Buyer',           'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_pr',             'name' => 'ZOPA PR User',         'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_grn',            'name' => 'ZOPA GRN User',        'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_approver_l1',    'name' => 'ZOPA Approver (L1)',   'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_approver_l2',    'name' => 'ZOPA Approver (L2)',   'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'zopa_approver_l3',    'name' => 'ZOPA Approver (L3)',   'type' => 'zopa',   'is_system' => 0],
            ['slug' => 'client_admin',        'name' => 'Client Admin',         'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_buyer',        'name' => 'Client Buyer',         'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_pr',           'name' => 'Client PR User',       'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_grn',          'name' => 'Client GRN User',      'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_approver_l1',  'name' => 'Client Approver L1',   'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_approver_l2',  'name' => 'Client Approver L2',   'type' => 'client', 'is_system' => 0],
            ['slug' => 'client_approver_l3',  'name' => 'Client Approver L3',   'type' => 'client', 'is_system' => 0],
        ];

        foreach ($roles as $role) {
            \Illuminate\Support\Facades\DB::table('org_roles')->insertOrIgnore([
                'slug'       => $role['slug'],
                'name'       => $role['name'],
                'type'       => $role['type'],
                'is_system'  => $role['is_system'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('org_roles');
    }
};
