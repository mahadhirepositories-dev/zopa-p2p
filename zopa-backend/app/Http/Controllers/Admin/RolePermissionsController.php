<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RolePermission;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Manages the role × module permission matrix.
 *
 * Admin routes (super_admin middleware):
 *   GET  /admin/role-permissions          → full matrix for the UI
 *   PUT  /admin/role-permissions/{role}   → save one role's permissions
 *
 * Public (authenticated, no tenant scope):
 *   GET  /role-permissions                → same matrix, used by frontend canDo()
 */
class RolePermissionsController extends Controller
{
    /** Roles managed through this screen. */
    public const ROLES = [
        'zopa_super_admin',
        'zopa_buyer',
        'zopa_approver_l1',
        'zopa_approver_l2',
        'zopa_approver_l3',
        'client_admin',
        'client_buyer',
        'client_approver_l1',
        'client_approver_l2',
        'client_approver_l3',
        'zopa_pr',
        'zopa_grn',
        'client_pr',
        'client_grn'
    ];

    /** Application modules whose permissions are configurable. */
    public const MODULES = [
        'purchase_requisitions',
        'purchase_orders',
        'grns',
        'invoices',
        'vendors',
        'products',
        'cost_centers',
        'org_masters',
        'approvals',
        'reports',
        'org_staff',
    ];

    public function __construct(private PermissionService $permissionService) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Admin: full matrix (for the Access Control management screen)
    // ─────────────────────────────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        // Dynamically load all available role slugs from the database
        $roles = \App\Models\Role::pluck('slug')->toArray();
        
        $matrix = $this->permissionService->buildMatrix($roles, self::MODULES);

        return response()->json([
            'matrix'  => $matrix,
            'roles'   => $roles,
            'modules' => self::MODULES,
        ]);
    }

    /**
     * Replace all module permissions for a single role.
     *
     * Request body:
     * {
     *   "modules": {
     *     "purchase_orders": { "can_view": true, "can_create": true, "can_edit": true, "can_delete": false },
     *     ...
     *   }
     * }
     */
    public function update(Request $request, string $role): JsonResponse
    {
        $validRoles = \App\Models\Role::pluck('slug')->toArray();
        if (!in_array($role, $validRoles, true)) {
            return response()->json(['message' => 'Invalid role.'], 422);
        }

        // Super admin permissions are enforced in code and cannot be restricted via this UI.
        if ($role === 'zopa_super_admin') {
            return response()->json(['message' => 'Super Admin permissions are immutable.'], 422);
        }

        $validated = $request->validate([
            'modules'              => 'required|array',
            'modules.*.can_view'   => 'required|boolean',
            'modules.*.can_create' => 'required|boolean',
            'modules.*.can_edit'   => 'required|boolean',
            'modules.*.can_delete' => 'required|boolean',
        ]);

        DB::transaction(function () use ($role, $validated) {
            foreach ($validated['modules'] as $module => $perms) {
                if (!in_array($module, self::MODULES, true)) {
                    continue; // silently skip unknown modules
                }

                RolePermission::updateOrCreate(
                    ['role' => $role, 'module' => $module],
                    [
                        'can_view'   => $perms['can_view'],
                        'can_create' => $perms['can_create'],
                        'can_edit'   => $perms['can_edit'],
                        'can_delete' => $perms['can_delete'],
                    ]
                );
            }
        });

        // Bust cache for this role and the shared matrix
        $this->permissionService->bustCache($role, self::MODULES);

        return response()->json(['message' => "Permissions for '{$role}' saved successfully."]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public (authenticated): matrix used by the frontend canDo() helper
    // ─────────────────────────────────────────────────────────────────────────

    public function matrix(): JsonResponse
    {
        $matrix = Cache::remember('role_permissions_matrix', 300, function () {
            $roles = \App\Models\Role::pluck('slug')->toArray();
            return $this->permissionService->buildMatrix($roles, self::MODULES);
        });

        return response()->json($matrix);
    }
}
