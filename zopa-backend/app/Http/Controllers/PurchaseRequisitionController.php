<?php

namespace App\Http\Controllers;

use App\Models\PrItem;
use App\Models\PurchaseRequisition;
use App\Services\ActivityLogService;
use App\Services\ApprovalService;
use App\Services\PrNumberService;
use App\Services\TatService;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseRequisitionController extends Controller
{
    use AuthorizesRoles;
    public function __construct(
        private PrNumberService    $prNumbers,
        private TatService         $tat,
        private ActivityLogService $actLog,
        private ApprovalService    $approval,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');

        $query = PurchaseRequisition::with([
            'requestedBy:id,name',
            'costCenter:id,name',
            'project:id,name',
            'location:id,name',
        ])->where('tenant_id', $tenant->id);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('requested_by')) {
            $query->where('requested_by', $request->requested_by);
        }

        return response()->json($query->latest()->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireTransactRole();
        $this->requirePermission('purchase_requisitions', 'create');

        $request->validate([
            'title'              => 'required|string|max:255',
            'cost_center_id'     => 'required|integer|exists:cost_centers,id',
            'project_id'         => 'nullable|integer|exists:projects,id',
            'location_id'        => 'nullable|integer|exists:locations,id',
            'priority'           => 'nullable|in:low,normal,high,urgent',
            'required_by_date'   => 'nullable|date',
            'required_by_person' => 'nullable|string|max:255',
            'description'        => 'nullable|string',
            'items'              => 'required|array|min:1',
            'items.*.description'     => 'required|string',
            'items.*.qty'             => 'required|numeric|min:0.001',
            'items.*.unit'            => 'nullable|string|max:30',
            'items.*.estimated_price' => 'nullable|numeric|min:0',
            'items.*.product_id'      => 'nullable|integer|exists:products,id',
            'items.*.category_id'     => 'nullable|integer|exists:categories,id',
        ]);

        $tenant = app('currentTenant');
        $user   = auth()->user();

        $pr = DB::transaction(function () use ($request, $tenant, $user) {
            $estimated = collect($request->items)->sum(
                fn($i) => ($i['qty'] ?? 1) * ($i['estimated_price'] ?? 0)
            );

            $pr = PurchaseRequisition::create([
                'tenant_id'          => $tenant->id,
                'pr_ref'             => 'PR-' . uniqid(),
                'title'              => $request->title,
                'description'        => $request->description,
                'cost_center_id'     => $request->cost_center_id,
                'project_id'         => $request->project_id,
                'location_id'        => $request->location_id,
                'priority'           => $request->priority ?? 'normal',
                'required_by_date'   => $request->required_by_date,
                'required_by_person' => $request->required_by_person,
                'estimated_amount'   => $estimated,
                'requested_by'       => $user->id,
                'status'             => 'draft',
            ]);

            foreach ($request->items as $i => $item) {
                PrItem::create([
                    'pr_id'           => $pr->id,
                    'sno'             => $i + 1,
                    'product_id'      => $item['product_id'] ?? null,
                    'description'     => $item['description'],
                    'category_id'     => $item['category_id'] ?? null,
                    'qty'             => $item['qty'],
                    'unit'            => $item['unit'] ?? 'nos',
                    'estimated_price' => $item['estimated_price'] ?? 0,
                    'remarks'         => $item['remarks'] ?? null,
                ]);
            }

            $this->actLog->log('PR', $pr->id, 'created', [
                'title'  => $pr->title,
                'status' => 'draft',
            ]);

            return $pr;
        });

        return response()->json($pr->load('items'), 201);
    }

    public function show(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->authorize($purchaseRequisition);

        // Auto-heal status: if PR has linked POs but status is still rfq_approved/rfq_created,
        // update it to 'converted' so the UI shows the correct state.
        $linkedPoCount = $purchaseRequisition->purchaseOrders()->count()
            + $purchaseRequisition->linkedPurchaseOrders()->count();
        if ($linkedPoCount > 0 && in_array($purchaseRequisition->status, ['rfq_approved', 'rfq_created', 'submitted'])) {
            $purchaseRequisition->update(['status' => 'converted', 'converted_at' => now()]);
        }

        return response()->json(
            $purchaseRequisition->fresh()->load([
                'items.product', 'items.category',
                'requestedBy:id,name,email',
                'buyer:id,name',
                'costCenter:id,name',
                'project:id,name',
                'location:id,name',
                'purchaseOrders.vendor:id,name',
                'linkedPurchaseOrders.vendor:id,name',
            ])
        );
    }

    public function update(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->requireTransactRole();
        $this->requirePermission('purchase_requisitions', 'edit');
        $this->authorize($purchaseRequisition);

        if (!in_array($purchaseRequisition->status, ['draft', 'submitted'])) {
            return response()->json(['error' => 'Only draft or submitted PRs can be edited.'], 422);
        }

        $request->validate([
            'title'              => 'sometimes|string|max:255',
            'cost_center_id'     => 'sometimes|integer|exists:cost_centers,id',
            'project_id'         => 'nullable|integer|exists:projects,id',
            'location_id'        => 'nullable|integer|exists:locations,id',
            'priority'           => 'nullable|in:low,normal,high,urgent',
            'required_by_date'   => 'nullable|date',
            'required_by_person' => 'nullable|string|max:255',
            'description'        => 'nullable|string',
            'items'              => 'sometimes|array|min:1',
            'items.*.description'     => 'required_with:items|string',
            'items.*.qty'             => 'required_with:items|numeric|min:0.001',
            'items.*.unit'            => 'nullable|string|max:30',
            'items.*.estimated_price' => 'nullable|numeric|min:0',
        ]);

        DB::transaction(function () use ($request, $purchaseRequisition) {
            if ($request->has('items')) {
                $purchaseRequisition->items()->delete();
                $estimated = 0;
                foreach ($request->items as $i => $item) {
                    PrItem::create([
                        'pr_id'           => $purchaseRequisition->id,
                        'sno'             => $i + 1,
                        'product_id'      => $item['product_id'] ?? null,
                        'description'     => $item['description'],
                        'category_id'     => $item['category_id'] ?? null,
                        'qty'             => $item['qty'],
                        'unit'            => $item['unit'] ?? 'nos',
                        'estimated_price' => $item['estimated_price'] ?? 0,
                        'remarks'         => $item['remarks'] ?? null,
                    ]);
                    $estimated += ($item['qty'] ?? 1) * ($item['estimated_price'] ?? 0);
                }
                $request->merge(['estimated_amount' => $estimated]);
            }

            $purchaseRequisition->update(
                $request->only([
                    'title', 'description', 'cost_center_id', 'project_id',
                    'location_id', 'priority', 'required_by_date', 'required_by_person', 'estimated_amount',
                ])
            );
        });

        $this->actLog->log('PR', $purchaseRequisition->id, 'updated');

        return response()->json($purchaseRequisition->fresh('items'));
    }

    public function submit(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->requireTransactRole();
        $this->authorize($purchaseRequisition);

        if ($purchaseRequisition->status !== 'draft') {
            return response()->json(['error' => 'Only draft PRs can be submitted.'], 422);
        }

        try {
            $tenant   = app('currentTenant');
            $prNumber = $this->prNumbers->generate($tenant);

            $purchaseRequisition->update([
                'pr_number'    => $prNumber,
                'pr_ref'       => $prNumber,
                'status'       => 'submitted',
                'submitted_at' => now(),
            ]);

            $this->actLog->log('PR', $purchaseRequisition->id, 'submitted', [
                'pr_number' => $prNumber,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'PR submission failed: ' . $e->getMessage()], 422);
        }

        return response()->json(
            $purchaseRequisition->fresh()->load([
                'items.product', 'items.category',
                'requestedBy:id,name,email',
                'buyer:id,name',
                'costCenter:id,name',
                'project:id,name',
                'location:id,name',
            ])
        );
    }

    /**
     * Mark RFQ as Created — buyer indicates RFQ sent to vendor(s).
     */
    public function rfqCreate(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->requireTransactRole();
        $this->authorize($purchaseRequisition);

        if ($purchaseRequisition->status !== 'submitted') {
            return response()->json(['error' => 'Only submitted PRs can have an RFQ created.'], 422);
        }

        $purchaseRequisition->update(['status' => 'rfq_created']);

        $this->actLog->log('PR', $purchaseRequisition->id, 'rfq_created', [
            'remarks' => $request->remarks ?? null,
        ]);

        return response()->json($purchaseRequisition->fresh());
    }

    /**
     * Mark RFQ as Approved — RFQ response evaluated and approved.
     */
    public function rfqApprove(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->requireTransactRole();
        $this->authorize($purchaseRequisition);

        if ($purchaseRequisition->status !== 'rfq_created') {
            return response()->json(['error' => 'Only PRs with RFQ Created status can be RFQ-approved.'], 422);
        }

        $purchaseRequisition->update(['status' => 'rfq_approved']);

        $this->actLog->log('PR', $purchaseRequisition->id, 'rfq_approved', [
            'remarks' => $request->remarks ?? null,
        ]);

        return response()->json($purchaseRequisition->fresh());
    }

    public function reject(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->requireAdminRole();
        $this->authorize($purchaseRequisition);

        if (!in_array($purchaseRequisition->status, ['submitted', 'rfq_created', 'rfq_approved'])) {
            return response()->json(['error' => 'PR cannot be rejected in its current state.'], 422);
        }

        $purchaseRequisition->update(['status' => 'rejected']);

        $this->actLog->log('PR', $purchaseRequisition->id, 'rejected', [
            'remarks' => $request->remarks ?? null,
        ]);

        return response()->json($purchaseRequisition->fresh());
    }

    public function destroy(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        // Transactional family + matrix 'delete' permission (authoritative) — a
        // coarse admin-only gate would override a delete granted in Access Control.
        $this->requireTransactRole();
        $this->requirePermission('purchase_requisitions', 'delete');
        $this->authorize($purchaseRequisition);

        if ($purchaseRequisition->status !== 'draft') {
            return response()->json(['error' => 'Only draft PRs can be deleted.'], 422);
        }

        $purchaseRequisition->delete();
        return response()->json(null, 204);
    }

    /**
     * Activity timeline for this PR.
     */
    public function activities(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->authorize($purchaseRequisition);
        return response()->json($this->actLog->forEntity('PR', $purchaseRequisition->id));
    }

    private function authorize(PurchaseRequisition $pr): void
    {
        abort_if($pr->tenant_id !== app('currentTenant')->id, 403);
    }
}
