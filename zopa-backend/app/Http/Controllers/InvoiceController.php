<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Services\ApprovalService;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    use AuthorizesRoles;

    public function __construct(private ApprovalService $approval) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');
        $query = Invoice::with(['purchaseOrder:id,po_number', 'grn:id,grn_number', 'approvedBy:id,name'])
            ->where('tenant_id', $tenant->id);

        if ($request->has('po_id')) {
            $query->where('po_id', $request->po_id);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $perPage = min((int) ($request->per_page ?? 500), 1000);
        return response()->json($query->latest()->paginate($perPage));
    }

    public function export(Request $request)
    {
        $tenant = app('currentTenant');
        $query = Invoice::with(['purchaseOrder:id,po_number', 'grn:id,grn_number', 'approvedBy:id,name'])
            ->where('tenant_id', $tenant->id);

        if ($request->has('po_id')) {
            $query->where('po_id', $request->po_id);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $data = $query->latest()->get()->map(fn($inv) => [
            'Invoice Number' => $inv->invoice_number,
            'PO Number' => optional($inv->purchaseOrder)->po_number,
            'GRN Number' => optional($inv->grn)->grn_number,
            'Invoice Date' => $inv->invoice_date,
            'Grand Total' => $inv->grand_total,
            'Status' => ucfirst($inv->status),
            'Approved By' => optional($inv->approvedBy)->name,
        ]);

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\GenericExport($data, ['Invoice Number', 'PO Number', 'GRN Number', 'Invoice Date', 'Grand Total', 'Status', 'Approved By']),
            'invoices.xlsx'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('invoices', 'create');

        $request->validate([
            'po_id'              => 'required|integer|exists:purchase_orders,id',
            'grn_id'             => 'nullable|integer|exists:grns,id',
            'invoice_number'     => 'required|string|max:100',
            'invoice_date'       => 'required|date',
            'vendor_invoice_ref' => 'nullable|string|max:100',
            'invoice_type'       => 'nullable|in:regular,advance,proforma',
            'amount'             => 'required|numeric|min:0',
            'freight'            => 'nullable|numeric|min:0',
            'notes'              => 'nullable|string|max:1000',
        ]);

        $tenant = app('currentTenant');
        $po = PurchaseOrder::findOrFail($request->po_id);
        abort_if($po->tenant_id !== $tenant->id, 403);

        // Partial invoice check: total invoiced amount must not exceed PO grand_total
        $existingInvoiced = Invoice::where('po_id', $request->po_id)
            ->whereIn('status', ['pending', 'approved'])
            ->whereIn('invoice_type', ['regular', 'proforma'])
            ->sum('amount');
        $newAmount = (float) $request->amount + (float) ($request->freight ?? 0);
        if ($existingInvoiced + $newAmount > (float) $po->grand_total) {
            return response()->json([
                'error' => "Invoice amount exceeds remaining PO value. Already invoiced: ₹" .
                    number_format($existingInvoiced, 2) .
                    " of ₹" . number_format($po->grand_total, 2) . ".",
            ], 422);
        }

        $invoice = DB::transaction(function () use ($request, $tenant) {
            $inv = Invoice::create([
                'tenant_id'          => $tenant->id,
                'po_id'              => $request->po_id,
                'grn_id'             => !empty($request->grn_id) ? $request->grn_id : null,
                'invoice_number'     => trim($request->invoice_number),
                'invoice_date'       => $request->invoice_date,
                'vendor_invoice_ref' => !empty($request->vendor_invoice_ref) ? trim($request->vendor_invoice_ref) : null,
                'invoice_type'       => $request->invoice_type ?? 'regular',
                'amount'             => (float) $request->amount,
                'freight'            => !empty($request->freight) ? (float) $request->freight : 0,
                'notes'              => !empty($request->notes) ? trim($request->notes) : null,
                'status'             => 'pending',
            ]);

            // Route through invoice approval matrix (auto-approves if no config set)
            $this->approval->routeInvoiceForApproval($inv);

            return $inv->fresh();
        });

        return response()->json($invoice->load('purchaseOrder:id,po_number', 'grn:id,grn_number'), 201);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        abort_if($invoice->tenant_id !== app('currentTenant')->id, 403);
        return response()->json(
            $invoice->load(['purchaseOrder.vendor', 'grn.items', 'approvedBy:id,name'])
        );
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        abort_if($invoice->tenant_id !== app('currentTenant')->id, 403);

        // Approving/rejecting an invoice is an admin-only financial action; plain
        // field edits are governed by the Access Control matrix (invoices.edit).
        if ($request->has('status') && in_array($request->status, ['approved', 'rejected'])) {
            $this->requireAdminRole();
        }
        $this->requirePermission('invoices', 'edit');

        if ($request->has('status') && in_array($request->status, ['approved', 'rejected'])) {
            DB::transaction(function () use ($request, $invoice) {
                $invoice->update([
                    'status'      => $request->status,
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]);

                // When an invoice is manually approved, advance the PO to 'invoiced'
                if ($request->status === 'approved') {
                    $po = PurchaseOrder::find($invoice->po_id);
                    if ($po && in_array($po->status, ['delivered', 'invoiced'])) {
                        $po->update([
                            'status'      => 'invoiced',
                            'invoiced_at' => $po->invoiced_at ?? now(),
                        ]);
                    }
                }
            });
        } else {
            $invoice->update($request->only('invoice_number', 'invoice_date', 'vendor_invoice_ref',
                'invoice_type', 'amount', 'freight', 'notes', 'grn_id'));
        }

        return response()->json($invoice->fresh());
    }
}
