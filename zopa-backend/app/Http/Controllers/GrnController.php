<?php

namespace App\Http\Controllers;

use App\Models\Grn;
use App\Models\GrnItem;
use App\Models\PurchaseOrder;
use App\Services\ActivityLogService;
use App\Services\TatService;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GrnController extends Controller
{
    use AuthorizesRoles;

    public function __construct(
        private ActivityLogService $actLog,
        private TatService         $tat,
    ) {}
    private function getTenant(): ?Tenant
    {
        if (app()->bound('currentTenant')) {
            return app('currentTenant');
        }
        $tenantId = request()->header('X-Tenant-ID');
        if ($tenantId) {
            return Tenant::find($tenantId);
        }
        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $tenant = $this->getTenant();
        $tenantId = $tenant?->id ?? $request->header('X-Tenant-ID');

        $query = Grn::with(['purchaseOrder:id,po_number', 'receivedBy:id,name']);
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->has('po_id')) {
            $query->where('po_id', $request->po_id);
        }

        $perPage = min((int) ($request->per_page ?? 500), 1000);
        return response()->json($query->latest()->paginate($perPage));
    }


    public function export(Request $request)
    {
        $tenant = app('currentTenant');
        $query = Grn::with(['purchaseOrder:id,po_number', 'receivedBy:id,name'])
            ->where('tenant_id', $tenant->id);

        if ($request->has('po_id')) {
            $query->where('po_id', $request->po_id);
        }

        $data = $query->latest()->get()->map(fn($grn) => [
            'GRN Number' => $grn->grn_number,
            'PO Number' => optional($grn->purchaseOrder)->po_number,
            'Received Date' => $grn->received_date,
            'Received By' => optional($grn->receivedBy)->name,
            'Created At' => $grn->created_at->format('Y-m-d H:i'),
        ]);

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\GenericExport($data, ['GRN Number', 'PO Number', 'Received Date', 'Received By', 'Created At']),
            'goods_receipts.xlsx'
        );
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
            'grn_number' => 'nullable|string|max:255',
            'received_date' => 'required|date',
            'dc_number' => 'nullable|string|max:255',
            'dc_date' => 'nullable|date',
            'invoice_number' => 'nullable|string|max:255',
            'invoice_date' => 'nullable|date',
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
            if ($request->filled('grn_number')) {
                $grnNumber = trim($request->grn_number);
            } else {
                $year    = now()->year;
                $orgCode = strtoupper(trim($tenant->code ?? 'ORG'));
                $prefix  = "{$orgCode}-GRN-{$year}-";

                $lastNumber = Grn::where('tenant_id', $tenant->id)
                    ->where('grn_number', 'like', $prefix . '%')
                    ->lockForUpdate()
                    ->max('grn_number');

                $seq       = $lastNumber ? ((int) substr($lastNumber, strlen($prefix))) + 1 : 1;
                $grnNumber = $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
            }

            $grn = Grn::create([
                'tenant_id' => $tenant->id,
                'po_id' => $request->po_id,
                'grn_number' => $grnNumber,
                'received_date' => $request->received_date,
                'dc_number' => $request->dc_number,
                'dc_date' => $request->dc_date,
                'invoice_number' => $request->invoice_number,
                'invoice_date' => $request->invoice_date,
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
            } else {
                $po->update(['delivery_status' => 'partially_delivered']);
            }
        }

        // ── TAT: stamp grn_received_at ────────────────────────────────────────
        if ($po) {
            $this->tat->stamp($po->id, 'grn_received_at', now());
        }

        // ── Activity log ──────────────────────────────────────────────────────
        $this->actLog->log('GRN', $grn->id, 'created', [
            'grn_number' => $grn->grn_number,
            'po_id'      => $grn->po_id,
            'po_number'  => $po?->po_number,
            'received_date' => $grn->received_date,
            'item_count' => count($request->items),
        ]);

        return response()->json($grn->load('items.poItem', 'receivedBy:id,name'), 201);
    }

    public function update(Request $request, Grn $grn): JsonResponse
    {
        $this->requirePermission('grns', 'create');
        $tenant = $this->getTenant();
        if ($tenant) {
            abort_if($grn->tenant_id !== $tenant->id, 403);
        }

        $request->validate([
            'status' => 'nullable|string|in:draft,pending,confirmed,rejected',
            'grn_number' => 'nullable|string|max:255',
            'received_date' => 'nullable|date',
            'dc_number' => 'nullable|string|max:255',
            'dc_date' => 'nullable|date',
            'invoice_number' => 'nullable|string|max:255',
            'invoice_date' => 'nullable|date',
            'remarks' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.id' => 'nullable|integer',
            'items.*.received_qty' => 'nullable|numeric|min:0',
            'items.*.accepted_qty' => 'nullable|numeric|min:0',
            'items.*.rejected_qty' => 'nullable|numeric|min:0',
            'items.*.remarks' => 'nullable|string',
        ]);

        $data = array_filter($request->only([
            'status', 'grn_number', 'received_date', 'dc_number', 'dc_date',
            'invoice_number', 'invoice_date', 'remarks',
        ]), fn($v) => !is_null($v));

        $grn->update($data);

        if ($request->has('items') && is_array($request->items)) {
            foreach ($request->items as $itemData) {
                if (!empty($itemData['id'])) {
                    GrnItem::where('id', $itemData['id'])
                        ->where('grn_id', $grn->id)
                        ->update([
                            'received_qty' => $itemData['received_qty'] ?? 0,
                            'accepted_qty' => $itemData['accepted_qty'] ?? 0,
                            'rejected_qty' => $itemData['rejected_qty'] ?? 0,
                            'remarks'      => $itemData['remarks'] ?? null,
                        ]);
                }
            }
        }

        // ── Tally PO delivery status across all confirmed GRNs ───────────────
        $po = PurchaseOrder::with('items')->find($grn->po_id);
        if ($po) {
            $allFullyReceived = true;
            $anyReceived = false;

            foreach ($po->items as $poItem) {
                $totalAccepted = GrnItem::whereHas('grn', function($q) use ($po) {
                    $q->where('po_id', $po->id)->where('status', 'confirmed');
                })->where('po_item_id', $poItem->id)->sum('accepted_qty');

                if ((float) $totalAccepted > 0) {
                    $anyReceived = true;
                }

                if ((float) $totalAccepted < (float) $poItem->qty) {
                    $allFullyReceived = false;
                }
            }

            if ($allFullyReceived) {
                $po->update(['status' => 'delivered', 'delivery_status' => 'delivered', 'delivered_at' => now()]);
            } elseif ($anyReceived) {
                $po->update(['delivery_status' => 'partially_delivered']);
            }
        }

        $this->actLog->log('GRN', $grn->id, 'updated', [
            'grn_number' => $grn->grn_number,
            'status' => $grn->status,
            'updated_by' => auth()->user()->name ?? auth()->id(),
        ]);

        return response()->json($grn->load(['items.poItem.product', 'purchaseOrder.vendor', 'receivedBy:id,name', 'attachments']));
    }



    public function show(Grn $grn): JsonResponse
    {
        $tenant = $this->getTenant();
        if ($tenant) {
            abort_if($grn->tenant_id !== $tenant->id, 403);
        }
        return response()->json(
            $grn->load(['items.poItem.product', 'purchaseOrder.vendor', 'receivedBy:id,name', 'attachments'])
        );
    }

    public function upload(Request $request, Grn $grn): JsonResponse
    {
        $this->requirePermission('grns', 'create');
        $request->validate(['file' => 'required|file|max:20480']);
        $tenant = $this->getTenant();
        if ($tenant) {
            abort_if($grn->tenant_id !== $tenant->id, 403);
        }

        $path = $request->file('file')->store("grn-attachments/{$grn->id}", 'local');

        $attachment = \App\Models\GrnAttachment::create([
            'grn_id' => $grn->id,
            'name' => pathinfo($request->file('file')->getClientOriginalName(), PATHINFO_FILENAME),
            'original_name' => $request->file('file')->getClientOriginalName(),
            'file_path' => $path,
            'size' => $request->file('file')->getSize(),
            'uploaded_by' => auth()->id(),
        ]);

        return response()->json($attachment, 201);
    }


    public function downloadAttachment(Grn $grn, \App\Models\GrnAttachment $attachment)
    {
        $tenant = $this->getTenant();
        if ($tenant) {
            abort_if($grn->tenant_id !== $tenant->id, 403);
        }
        abort_if($attachment->grn_id !== $grn->id, 404);

        abort_if(!\Illuminate\Support\Facades\Storage::disk('local')->exists($attachment->file_path), 404, 'File not found on server.');
        
        $path = \Illuminate\Support\Facades\Storage::disk('local')->path($attachment->file_path);

        // Use response()->file() to display inline (view) instead of forcing download
        return response()->file($path);
    }

    public function pdf(Grn $grn)
    {
        $tenant = $this->getTenant();
        if ($tenant) {
            abort_if($grn->tenant_id !== $tenant->id, 403);
        }
        $bytes  = \App\Services\PdfService::makeGrnPdf($grn);
        $safeNo = str_replace(['/', '\\'], '-', (string) ($grn->grn_number ?: $grn->id));

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="GRN-' . $safeNo . '.pdf"',
        ]);
    }

    /** Issue a short-lived signed URL so the frontend can open the PDF in a new tab without re-auth. */
    public function pdfUrl(Grn $grn)
    {
        $tenant = $this->getTenant();
        if ($tenant) {
            abort_if($grn->tenant_id !== $tenant->id, 403);
        }
        $token = \Illuminate\Support\Facades\Cache::remember(
            "grn_pdf_token_{$grn->id}",
            now()->addMinutes(10),
            fn () => \Illuminate\Support\Str::random(40)
        );
        // Store token → grn id mapping
        \Illuminate\Support\Facades\Cache::put("grn_pdf_tkn_{$token}", $grn->id, now()->addMinutes(10));

        return response()->json([
            'url' => url("/api/grn-pdf/{$grn->id}?token={$token}"),
        ]);
    }


}
