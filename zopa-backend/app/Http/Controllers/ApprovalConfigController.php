<?php

namespace App\Http\Controllers;

use App\Models\ApprovalConfig;
use App\Models\CostCenter;
use App\Models\User;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalConfigController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request, CostCenter $costCenter): JsonResponse
    {
        $this->authorizeCostCenter($costCenter);
        $type = $request->get('type', 'po');

        $configs = $costCenter->approvalConfigs()
            ->with('user:id,name,email')
            ->where('type', $type)
            ->orderBy('level')
            ->get();

        // Enrich each config with full user details for multi-user rows
        $configs->each(function ($config) {
            $ids = $config->resolved_user_ids;
            $config->users_detail = $ids
                ? User::whereIn('id', $ids)->select('id', 'name', 'email')->get()
                : collect();
        });

        return response()->json($configs);
    }

    public function store(Request $request, CostCenter $costCenter): JsonResponse
    {
        $this->requireAdminRole();
        $this->authorizeCostCenter($costCenter);

        $request->validate([
            'type'         => 'nullable|in:po,invoice,pr',
            'level'        => 'required|integer|in:1,2,3',
            'user_ids'     => 'nullable|array',
            'user_ids.*'   => 'integer|exists:users,id',
            'user_id'      => 'nullable|integer|exists:users,id',  // legacy single-user
            'amount_limit' => 'nullable|numeric|min:0',
        ]);

        $type = $request->get('type', 'po');

        // Resolve final user list: prefer user_ids array, fall back to single user_id
        $userIds = $request->user_ids ?? ($request->user_id ? [$request->user_id] : []);

        if (empty($userIds)) {
            return response()->json(['message' => 'At least one approver is required.'], 422);
        }

        // For backward-compat keep user_id = first in list
        $primaryUserId = $userIds[0];

        $config = ApprovalConfig::updateOrCreate(
            ['cost_center_id' => $costCenter->id, 'type' => $type, 'level' => $request->level],
            [
                'user_id'      => $primaryUserId,
                'user_ids'     => count($userIds) > 1 ? $userIds : null,
                'amount_limit' => $request->amount_limit,
                'is_active'    => true,
            ]
        );

        $config->users_detail = User::whereIn('id', $config->resolved_user_ids)
            ->select('id', 'name', 'email')->get();

        return response()->json($config->load('user:id,name,email'), 201);
    }

    public function update(Request $request, CostCenter $costCenter, ApprovalConfig $approvalConfig): JsonResponse
    {
        $this->requireAdminRole();
        $this->authorizeCostCenter($costCenter);
        abort_if($approvalConfig->cost_center_id !== $costCenter->id, 403);

        $request->validate([
            'user_ids'     => 'nullable|array',
            'user_ids.*'   => 'integer|exists:users,id',
            'user_id'      => 'nullable|integer|exists:users,id',
            'amount_limit' => 'nullable|numeric|min:0',
            'is_active'    => 'nullable|boolean',
        ]);

        $userIds = $request->user_ids ?? ($request->user_id ? [$request->user_id] : null);

        $data = $request->only('amount_limit', 'is_active');
        if ($userIds !== null) {
            $data['user_id']  = $userIds[0];
            $data['user_ids'] = count($userIds) > 1 ? $userIds : null;
        }

        $approvalConfig->update($data);

        $approvalConfig->users_detail = User::whereIn('id', $approvalConfig->resolved_user_ids)
            ->select('id', 'name', 'email')->get();

        return response()->json($approvalConfig->load('user:id,name,email'));
    }

    public function destroy(CostCenter $costCenter, ApprovalConfig $approvalConfig): JsonResponse
    {
        $this->requireAdminRole();
        $this->authorizeCostCenter($costCenter);
        abort_if($approvalConfig->cost_center_id !== $costCenter->id, 403);

        $approvalConfig->delete();
        return response()->json(null, 204);
    }

    private function authorizeCostCenter(CostCenter $cc): void
    {
        abort_if($cc->tenant_id !== app('currentTenant')->id, 403);
    }
}
