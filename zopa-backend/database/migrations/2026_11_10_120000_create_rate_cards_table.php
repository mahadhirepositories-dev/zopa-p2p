<?php

use App\Services\PermissionService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A rate card is one organisation's agreed rate for a product from a vendor.
 * PO lines for that vendor and product must use it. Changes are logged in
 * activity_logs (entity_type RATE_CARD).
 */
return new class extends Migration
{
    /** role => [view, create, edit, delete]; same shape as RolePermissionSeeder. */
    private const GRANTS = [
        'zopa_super_admin'   => [true, true, true, true],
        'client_admin'       => [true, true, true, true],
        'zopa_buyer'         => [true, true, true, false],
        'client_buyer'       => [true, true, true, false],
        'zopa_approver_l1'   => [true, false, false, false],
        'zopa_approver_l2'   => [true, false, false, false],
        'zopa_approver_l3'   => [true, false, false, false],
        'client_approver_l1' => [true, false, false, false],
        'client_approver_l2' => [true, false, false, false],
        'client_approver_l3' => [true, false, false, false],
    ];

    public function up(): void
    {
        Schema::create('rate_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->decimal('net_rate', 15, 2);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'vendor_id', 'product_id']);
        });

        $now = now();
        foreach (self::GRANTS as $role => [$v, $c, $e, $d]) {
            DB::table('role_permissions')->insertOrIgnore([
                'role' => $role, 'module' => 'rate_cards',
                'can_view' => $v, 'can_create' => $c, 'can_edit' => $e, 'can_delete' => $d,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            app(PermissionService::class)->bustCache($role, ['rate_cards']);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('rate_cards');
        DB::table('role_permissions')->where('module', 'rate_cards')->delete();
    }
};
