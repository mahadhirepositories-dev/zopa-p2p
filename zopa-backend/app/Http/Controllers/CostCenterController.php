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

        $request->validate([
            'name'                => 'required|string|max:255',
            'annual_budget'       => 'required|numeric|min:0',
            'current_fiscal_year' => 'required|integer|min:2020',
            'budget_from'         => 'nullable|date',
            'budget_to'           => 'nullable|date|after_or_equal:budget_from',
        ]);

        $tenant = app('currentTenant');
        $cc = CostCenter::create([
            ...$request->only('name', 'department_id', 'project_id', 'location_id',
                              'annual_budget', 'budget_from', 'budget_to', 'current_fiscal_year'),
            'tenant_id' => $tenant->id,
        ]);

        if ($request->has('user_ids')) {
            $cc->users()->sync($request->user_ids);
        }

        if ($request->has('location_ids')) {
            $cc->locations()->sync($request->location_ids);
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
        $costCenter->update($request->except('tenant_id'));
        if ($request->has('user_ids')) {
            $costCenter->users()->sync($request->user_ids);
        }
        if ($request->has('location_ids')) {
            $costCenter->locations()->sync($request->location_ids);
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
