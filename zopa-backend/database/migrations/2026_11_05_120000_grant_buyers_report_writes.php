<?php

use App\Services\PermissionService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Buyers write the operational reports, but the matrix only gave them view, which
 * went unnoticed while the report API checked nothing. Now that it does, this keeps
 * their start, edit and send working. A role whose view was revoked stays revoked.
 */
return new class extends Migration
{
    private const BUYERS = ['zopa_buyer', 'client_buyer'];

    public function up(): void
    {
        $this->setReportWrites(true);
    }

    public function down(): void
    {
        $this->setReportWrites(false);
    }

    private function setReportWrites(bool $allowed): void
    {
        DB::table('role_permissions')
            ->whereIn('role', self::BUYERS)
            ->where('module', 'reports')
            ->where('can_view', true)
            ->update(['can_create' => $allowed, 'can_edit' => $allowed, 'updated_at' => now()]);

        foreach (self::BUYERS as $role) {
            app(PermissionService::class)->bustCache($role, ['reports']);
        }
    }
};
