<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Models\UserTenantRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantScopeMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = auth()->user();
        $tenantId = $request->header('X-Tenant-ID');

        if (!$tenantId) {
            return response()->json(['error' => 'X-Tenant-ID header is required'], 400);
        }

        if ($user->is_zopa_staff) {
            if ($user->isSuperAdmin()) {
                app()->instance('currentTenant', Tenant::findOrFail($tenantId));
                app()->instance('currentRole', 'zopa_super_admin');
                return $next($request);
            }

            $assignment = UserTenantRole::where('user_id', $user->id)
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->first();

            if (!$assignment) {
                return response()->json(['error' => 'Not assigned to this client'], 403);
            }

            app()->instance('currentTenant', Tenant::findOrFail($tenantId));
            app()->instance('currentRole', $assignment->role);
        } else {
            // Scope to the exact tenant in the header — prevents wrong assignment
            // for users who may have roles in more than one tenant.
            $assignment = UserTenantRole::where('user_id', $user->id)
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->first();

            if (!$assignment) {
                return response()->json(['error' => 'Access denied for this organisation.'], 403);
            }

            app()->instance('currentTenant', Tenant::findOrFail($assignment->tenant_id));
            app()->instance('currentRole', $assignment->role);
        }

        return $next($request);
    }
}
