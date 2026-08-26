<?php

namespace App\Http\Controllers;

use App\Models\CostCenter;
use App\Services\BudgetService;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CostCenterController extends Controller
{
    use AuthorizesRoles;

    public function __construct(private BudgetService $budget) {}

    public function index(): JsonResponse
    {
        $tenant = app('currentTenant');
        return response()->json(
            CostCenter::where('tenant_id', $tenant->id)
                ->with(['department', 'project', 'location', 'users:id,name,email', 'locations'])
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('cost_centers', 'create');

        $validated = $request->validate([
            'name'                => 'required|string|max:255',
            'annual_budget'       => 'required|numeric|min:0',
            'current_fiscal_year' => 'nullable|integer|min:2020',
            'budget_from'         => 'nullable|date',
            'budget_to'           => 'nullable|date|after_or_equal:budget_from',
            'department_id'       => 'nullable|integer|exists:departments,id',
            'project_id'          => 'nullable|integer|exists:projects,id',
            'location_id'         => 'nullable|integer|exists:locations,id',
            'user_ids'            => 'nullable|array',
            'user_ids.*'          => 'integer|exists:users,id',
            'location_ids'        => 'nullable|array',
            'location_ids.*'      => 'integer|exists:locations,id',
        ]);

        $tenant = app('currentTenant');
        $cc = CostCenter::create([
            'tenant_id'           => $tenant->id,
            'name'                => $validated['name'],
            'department_id'       => !empty($validated['department_id']) ? $validated['department_id'] : null,
            'project_id'          => !empty($validated['project_id']) ? $validated['project_id'] : null,
            'location_id'         => !empty($validated['location_id']) ? $validated['location_id'] : null,
            'annual_budget'       => $validated['annual_budget'] ?? 0,
            'budget_from'         => !empty($validated['budget_from']) ? $validated['budget_from'] : null,
            'budget_to'           => !empty($validated['budget_to']) ? $validated['budget_to'] : null,
            'current_fiscal_year' => !empty($validated['current_fiscal_year']) ? $validated['current_fiscal_year'] : date('Y'),
            'is_active'           => true,
        ]);

        if ($request->has('user_ids')) {
            $cc->users()->sync($request->user_ids ?: []);
        }

        if ($request->has('location_ids')) {
            $cc->locations()->sync($request->location_ids ?: []);
        }

        return response()->json($cc->load('department', 'project', 'location', 'users:id,name,email', 'locations'), 201);
    }

    public function show(CostCenter $costCenter): JsonResponse
    {
        $this->authorizeCostCenter($costCenter);
        return response()->json($costCenter->load('department', 'project', 'location', 'approvalConfigs.user', 'users:id,name,email', 'locations'));
    }

    public function update(Request $request, CostCenter $costCenter): JsonResponse
    {
        $this->requirePermission('cost_centers', 'edit');
        $this->authorizeCostCenter($costCenter);

        $validated = $request->validate([
            'name'                => 'sometimes|required|string|max:255',
            'annual_budget'       => 'sometimes|required|numeric|min:0',
            'current_fiscal_year' => 'nullable|integer|min:2020',
            'budget_from'         => 'nullable|date',
            'budget_to'           => 'nullable|date|after_or_equal:budget_from',
            'department_id'       => 'nullable|integer|exists:departments,id',
            'project_id'          => 'nullable|integer|exists:projects,id',
            'location_id'         => 'nullable|integer|exists:locations,id',
            'is_active'           => 'nullable|boolean',
            'user_ids'            => 'nullable|array',
            'user_ids.*'          => 'integer|exists:users,id',
            'location_ids'        => 'nullable|array',
            'location_ids.*'      => 'integer|exists:locations,id',
        ]);

        $data = $request->only('name', 'annual_budget', 'is_active', 'current_fiscal_year');
        if ($request->has('department_id')) {
            $data['department_id'] = !empty($request->department_id) ? $request->department_id : null;
        }
        if ($request->has('project_id')) {
            $data['project_id'] = !empty($request->project_id) ? $request->project_id : null;
        }
        if ($request->has('location_id')) {
            $data['location_id'] = !empty($request->location_id) ? $request->location_id : null;
        }
        if ($request->has('budget_from')) {
            $data['budget_from'] = !empty($request->budget_from) ? $request->budget_from : null;
        }
        if ($request->has('budget_to')) {
            $data['budget_to'] = !empty($request->budget_to) ? $request->budget_to : null;
        }

        $costCenter->update($data);

        if ($request->has('user_ids')) {
            $costCenter->users()->sync($request->user_ids ?: []);
        }
        if ($request->has('location_ids')) {
            $costCenter->locations()->sync($request->location_ids ?: []);
        }
        return response()->json($costCenter->load('department', 'project', 'location', 'users:id,name,email', 'locations'));
    }

    public function destroy(CostCenter $costCenter): JsonResponse
    {
        $this->requirePermission('cost_centers', 'delete');
        $this->authorizeCostCenter($costCenter);
        $costCenter->update(['is_active' => false]);
        return response()->json(null, 204);
    }

    public function budget(CostCenter $costCenter): JsonResponse
    {
        $this->authorizeCostCenter($costCenter);
        $fiscalYear = $this->budget->currentFiscalYear($costCenter->load('tenant'));
        $data = $this->budget->getAvailable($costCenter->id, $fiscalYear);
        return response()->json($data);
    }

    public function budgetLedger(CostCenter $costCenter): JsonResponse
    {
        $this->authorizeCostCenter($costCenter);
        return response()->json(
            $costCenter->budgetLedger()->with('createdBy')->latest()->paginate(50)
        );
    }

    public function adjustBudget(Request $request, CostCenter $costCenter): JsonResponse
    {
        $this->requireAdminRole();
        $this->authorizeCostCenter($costCenter);

        $request->validate([
            'action'    => 'required|in:add,reduce',
            'amount'    => 'required|numeric|min:0.01',
            'narration' => 'required|string|max:500',
        ]);

        $sign   = $request->action === 'add' ? 1 : -1;
        $amount = abs((float) $request->amount);
        $newBudget = $costCenter->annual_budget + ($sign * $amount);

        if ($newBudget < 0) {
            return response()->json(['error' => 'Budget cannot go below zero.'], 422);
        }

        $fiscalYear = $this->budget->currentFiscalYear($costCenter->load('tenant'));
        $user = auth()->user();

        \App\Models\BudgetLedger::create([
            'cost_center_id' => $costCenter->id,
            'fiscal_year'    => $fiscalYear,
            'reference_type' => 'ADJUSTMENT',
            'reference_id'   => 0,
            'adjust_amount'  => $sign * $amount,
            'action'         => 'adjust',
            'narration'      => ($request->action === 'add' ? 'Budget added: ' : 'Budget reduced: ') . $request->narration,
            'created_by'     => $user->id,
        ]);

        $costCenter->update(['annual_budget' => $newBudget]);

        return response()->json([
            'annual_budget' => $costCenter->annual_budget,
            'action'        => $request->action,
            'amount'        => $amount,
        ]);
    }

    private function authorizeCostCenter(CostCenter $cc): void
    {
        abort_if($cc->tenant_id !== app('currentTenant')->id, 403);
    }
}
