<?php

namespace App\Http\Controllers;

use App\Models\Grn;
use App\Models\GrnItem;
use App\Models\PurchaseOrder;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GrnController extends Controller
{
    use AuthorizesRoles;
    public function index(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');
        $query = Grn::with(['purchaseOrder:id,po_number', 'receivedBy:id,name'])
            ->where('tenant_id', $tenant->id);

        if ($request->has('po_id')) {
            $query->where('po_id', $request->po_id);
        }

        return response()->json($query->latest()->paginate(20));
    }

    public function forPo(PurchaseOrder $purchaseOrder): JsonResponse
    {
        abort_if($purchaseOrder->tenant_id !== app('currentTenant')->id, 403);
        return response()->json(
            Grn::with(['items.poItem', 'receivedBy:id,name'])
                ->where('po_id', $purchaseOrder->id)
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('grns', 'create');

        $request->validate([
            'po_id' => 'required|integer|exists:purchase_orders,id',
            'received_date' => 'required|date',
            'remarks' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.po_item_id' => 'required|integer|exists:po_items,id',
            'items.*.received_qty' => 'required|numeric|min:0',
            'items.*.accepted_qty' => 'required|numeric|min:0',
            'items.*.rejected_qty' => 'nullable|numeric|min:0',
            'items.*.remarks' => 'nullable|string',
        ]);

        $tenant = app('currentTenant');
        $po = PurchaseOrder::findOrFail($request->po_id);
        abort_if($po->tenant_id !== $tenant->id, 403);

        $grn = DB::transaction(function () use ($request, $tenant) {
            $year    = now()->year;
            $orgCode = strtoupper(trim($tenant->code ?? 'ORG'));
            $prefix  = "{$orgCode}-GRN-{$year}-";

            // Lock the latest row to prevent race conditions, then derive next seq
            $lastNumber = Grn::where('tenant_id', $tenant->id)
                ->where('grn_number', 'like', $prefix . '%')
                ->lockForUpdate()
                ->max('grn_number');

            $seq       = $lastNumber ? ((int) substr($lastNumber, strlen($prefix))) + 1 : 1;
            $grnNumber = $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);

            $grn = Grn::create([
                'tenant_id' => $tenant->id,
                'po_id' => $request->po_id,
                'grn_number' => $grnNumber,
                'received_date' => $request->received_date,
                'received_by' => auth()->id(),
                'status' => 'confirmed',
                'remarks' => $request->remarks,
            ]);

            foreach ($request->items as $item) {
                GrnItem::create([
                    'grn_id' => $grn->id,
                    'po_item_id' => $item['po_item_id'],
                    'received_qty' => $item['received_qty'],
                    'accepted_qty' => $item['accepted_qty'],
                    'rejected_qty' => $item['rejected_qty'] ?? max(0, $item['received_qty'] - $item['accepted_qty']),
                    'remarks' => $item['remarks'] ?? null,
                ]);
            }

            return $grn;
        });

        // Auto-deliver the PO if every item is now fully received
        $po = PurchaseOrder::with('items')->find($request->po_id);
        if ($po && in_array($po->status, ['released', 'approved'])) {
            $allFullyReceived = true;
            foreach ($po->items as $poItem) {
                $totalAccepted = GrnItem::whereHas('grn', fn($q) => $q->where('po_id', $po->id))
                    ->where('po_item_id', $poItem->id)
                    ->sum('accepted_qty');
                if ((float) $totalAccepted < (float) $poItem->qty) {
                    $allFullyReceived = false;
                    break;
                }
            }
            if ($allFullyReceived) {
                $po->update(['status' => 'delivered', 'delivered_at' => now()]);
            }
        }

        return response()->json($grn->load('items.poItem', 'receivedBy:id,name'), 201);
    }

    public function show(Grn $grn): JsonResponse
    {
        abort_if($grn->tenant_id !== app('currentTenant')->id, 403);
        return response()->json(
            $grn->load(['items.poItem.product', 'purchaseOrder.vendor', 'receivedBy:id,name'])
        );
    }
}
