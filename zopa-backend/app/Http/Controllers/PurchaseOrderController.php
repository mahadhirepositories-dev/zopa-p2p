<?php

namespace App\Http\Controllers;

use App\Models\PoAttachment;
use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Services\ActivityLogService;
use App\Services\ApprovalService;
use App\Services\BudgetService;
use App\Services\GstService;
use App\Services\PoNumberService;
use App\Services\TatService;
use App\Traits\AuthorizesRoles;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use App\Mail\PurchaseOrderIssuedMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class PurchaseOrderController extends Controller
{
    use AuthorizesRoles;
    public function __construct(
        private BudgetService      $budget,
        private GstService         $gst,
        private ApprovalService    $approval,
        private TatService         $tat,
        private ActivityLogService $actLog,
        private PoNumberService    $poNumbers,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');

        $query = PurchaseOrder::with(['vendor', 'costCenter', 'creator'])
            ->where('tenant_id', $tenant->id);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Multi-status filter: ?statuses[]=released&statuses[]=delivered
        if ($request->has('statuses')) {
            $query->whereIn('status', (array) $request->statuses);
        }

        // Hide drafts from non-transact roles (like Approvers)
        if (!$this->hasTransactRole()) {
            $query->where('status', '!=', 'draft');
        }

        // grn_eligible=1 → exclude POs where every item is already fully received
        if ($request->boolean('grn_eligible')) {
            $query->whereExists(function ($sub) {
                // Keep the PO only if at least one po_item still has remaining qty
                $sub->selectRaw('1')
                    ->from('po_items')
                    ->whereColumn('po_items.po_id', 'purchase_orders.id')
                    ->whereRaw('
                        po_items.qty > COALESCE((
                            SELECT SUM(gi.accepted_qty)
                            FROM grn_items gi
                            JOIN grns g ON g.id = gi.grn_id
                            WHERE g.po_id = purchase_orders.id
                              AND gi.po_item_id = po_items.id
                        ), 0)
                    ');
            });
        }

        if ($request->has('cost_center_id')) {
            $query->where('cost_center_id', $request->cost_center_id);
        }

        $perPage = min((int) ($request->per_page ?? 20), 200);
        return response()->json($query->latest()->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('purchase_orders', 'create');

        $request->validate([
            'vendor_id' => 'required|integer',
            'cost_center_id' => 'required|integer',
            'po_valid_till' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.qty' => 'required|numeric|min:0.001',
            'items.*.unit' => 'nullable|string|max:20',
            'items.*.net_rate' => 'required|numeric|min:0',
            'items.*.gst_rate' => 'required|numeric|min:0',
            'items.*.required_by' => 'nullable|date',
            'freight' => 'nullable|numeric|min:0',
            'freight_gst_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        $tenant = app('currentTenant');
        $user = auth()->user();

        $vendorAddress = \App\Models\VendorAddress::find($request->vendor_address_id);
        $billToLocation = \App\Models\Location::find($request->bill_to_location_id);

        $vendorStateCode = $vendorAddress?->state_code ?? '';
        $companyStateCode = $billToLocation?->state_code ?? '';

        $totals = $this->gst->calculatePoTotals(
            $request->items,
            (float) ($request->freight ?? 0),
            $vendorStateCode,
            $companyStateCode,
            (float) ($request->freight_gst_rate ?? 0)
        );

        $costCenter = \App\Models\CostCenter::with('tenant')->find($request->cost_center_id);
        if (!$costCenter) {
            return response()->json(['error' => 'Selected cost center not found.'], 422);
        }

        $fiscalYear = $this->budget->currentFiscalYear($costCenter);
        $budget = $this->budget->getAvailable($request->cost_center_id, $fiscalYear);

        if ($totals['grand_total'] > $budget['available']) {
            return response()->json(['error' => "Insufficient budget. Available: ₹" . number_format($budget['available'], 2) . ", Required: ₹" . number_format($totals['grand_total'], 2) . "."], 422);
        }

        $po = DB::transaction(function () use ($request, $tenant, $user, $totals) {
            $po = PurchaseOrder::create([
                ...$request->only([
                    'pr_id', 'pr_reference', 'vendor_id', 'vendor_address_id', 'cost_center_id',
                    'bill_to_location_id', 'ship_to_location_id',
                    'po_valid_till', 'payment_terms_json', 'warranty_months',
                    'terms_conditions',
                ]),
                'tenant_id' => $tenant->id,
                'freight' => $request->freight ?? 0,
                'freight_gst_rate' => $request->freight_gst_rate ?? 0,
                'created_by' => $user->id,
                'created_by_role' => app('currentRole'),
                'status' => 'draft',
                ...$totals,
            ]);

            // Track which PRs are linked so we can update conversion tracking
            $linkedPrIds = array_filter(array_unique(
                array_merge(
                    $request->filled('pr_id') ? [$request->pr_id] : [],
                    collect($request->items)->pluck('pr_id')->filter()->unique()->values()->toArray()
                )
            ));

            // Snapshot product master fields at creation so the document never
            // changes if the product is later edited (renamed / re-coded / new HSN).
            $productMap = \App\Models\Product::whereIn(
                'id', collect($request->items)->pluck('product_id')->filter()->unique()
            )->get()->keyBy('id');

            foreach ($request->items as $i => $item) {
                $grossRate = $item['net_rate'] * (1 + $item['gst_rate'] / 100);
                $product = isset($item['product_id']) ? $productMap->get($item['product_id']) : null;
                PoItem::create([
                    'po_id' => $po->id,
                    'sno' => $i + 1,
                    'pr_item_id' => $item['pr_item_id'] ?? null,
                    'product_id' => $item['product_id'] ?? null,
                    'product_code' => $product?->code,
                    'product_name' => $product?->name,
                    'hsn_code' => $product?->hsn_code,
                    'description' => $item['description'],
                    'category_id' => $item['category_id'] ?? null,
                    'qty' => $item['qty'],
                    'unit' => $item['unit'] ?? null,
                    'net_rate' => $item['net_rate'],
                    'gst_rate' => $item['gst_rate'],
                    'gross_rate' => $grossRate,
                    'amount' => $grossRate * $item['qty'],
                    'required_by' => $item['required_by'] ?? null,
                    'warranty_months' => $item['warranty_months'] ?? 0,
                ]);

                // Update converted_qty on the source PR item
                if (!empty($item['pr_item_id'])) {
                    $prItem = \App\Models\PrItem::find($item['pr_item_id']);
                    if ($prItem) {
                        $prItem->increment('converted_qty', $item['qty']);
                    }
                }
            }

            $this->tat->stamp($po->id, 'po_created_at', now());

            // Determine whether this PO has item-level PR tracking (pr_item_id on any item)
            $hasItemTracking = collect($request->items)->contains(fn($i) => !empty($i['pr_item_id']));

            // Link all PRs and update their statuses
            foreach ($linkedPrIds as $prId) {
                $pr = \App\Models\PurchaseRequisition::with('items')->find($prId);
                if (!$pr) continue;

                // Attach to po_prs pivot
                $po->prs()->syncWithoutDetaching([$prId]);

                if ($hasItemTracking) {
                    // Fine-grained: use converted_qty to determine partial vs full
                    $pr->load('items');
                    $allConverted = $pr->items->every(fn($it) => (float)$it->converted_qty >= (float)$it->qty);
                    $anyConverted = $pr->items->some(fn($it)  => (float)$it->converted_qty > 0);

                    if ($allConverted)      $newStatus = 'converted';
                    elseif ($anyConverted)  $newStatus = 'partially_converted';
                    else                   $newStatus = 'converted'; // pr_id linked but no item ids yet
                } else {
                    // No per-item tracking → treat entire PR as fully converted
                    $newStatus = 'converted';
                }

                $pr->update([
                    'status'       => $newStatus,
                    'buyer_id'     => auth()->id(),
                    'converted_at' => now(),
                ]);

                \App\Models\TatRecord::where('po_id', $po->id)->update([
                    'pr_id'           => $prId,
                    'pr_submitted_at' => $pr->submitted_at,
                ]);

                $this->actLog->log('PR', $prId, $newStatus, ['po_id' => $po->id]);
            }

            $this->actLog->log('PO', $po->id, 'created', ['status' => 'draft', 'amount' => (float) $po->grand_total]);

            return $po;
        });

        return response()->json($po->load('items'), 201);
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorizePoAccess($purchaseOrder);
        return response()->json(
            $purchaseOrder->load([
                'items.product', 'items.prItem',
                'vendor', 'vendorAddress',
                'costCenter.department', 'costCenter.project', 'costCenter.location',
                'approvals.assignedTo', 'attachments',
                'invoices', 'grns',
                'pr:id,pr_number,title,status',
                'prs:id,pr_number,title,status',
            ])
        );
    }

    public function activities(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorizePoAccess($purchaseOrder);
        return response()->json($this->actLog->forEntity('PO', $purchaseOrder->id));
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requirePermission('purchase_orders', 'edit');
        $this->authorizePoAccess($purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return response()->json(['error' => 'Only draft POs can be edited.'], 422);
        }

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.qty' => 'required|numeric|min:0.001',
            'items.*.unit' => 'nullable|string|max:20',
            'items.*.net_rate' => 'required|numeric|min:0',
            'items.*.gst_rate' => 'required|numeric|min:0',
            'items.*.required_by' => 'nullable|date',
            'freight' => 'nullable|numeric|min:0',
            'freight_gst_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        try {
            $po = DB::transaction(function () use ($request, $purchaseOrder) {
                // Recompute totals from the edited lines (IGST vs CGST+SGST by state)
                // — a draft edit must not keep the original stale totals.
                $vendorAddress  = \App\Models\VendorAddress::find($request->vendor_address_id);
                $billToLocation = \App\Models\Location::find($request->bill_to_location_id);
                $totals = $this->gst->calculatePoTotals(
                    $request->items,
                    (float) ($request->freight ?? 0),
                    $vendorAddress?->state_code ?? '',
                    $billToLocation?->state_code ?? '',
                    (float) ($request->freight_gst_rate ?? 0),
                );

                $productMap = \App\Models\Product::whereIn(
                    'id', collect($request->items)->pluck('product_id')->filter()->unique()
                )->get()->keyBy('id');

                $purchaseOrder->items()->delete();
                foreach ($request->items as $i => $item) {
                    $grossRate = $item['net_rate'] * (1 + $item['gst_rate'] / 100);
                    $product = isset($item['product_id']) ? $productMap->get($item['product_id']) : null;
                    PoItem::create([
                        'po_id' => $purchaseOrder->id,
                        'sno' => $i + 1,
                        'product_id' => $item['product_id'] ?? null,
                        'product_code' => $product?->code,
                        'product_name' => $product?->name,
                        'hsn_code' => $product?->hsn_code,
                        'description' => $item['description'],
                        'category_id' => $item['category_id'] ?? null,
                        'qty' => $item['qty'],
                        'unit' => $item['unit'] ?? null,
                        'net_rate' => $item['net_rate'],
                        'gst_rate' => $item['gst_rate'],
                        'gross_rate' => $grossRate,
                        'amount' => $grossRate * $item['qty'],
                        'required_by' => $item['required_by'] ?? null,
                        'warranty_months' => $item['warranty_months'] ?? 0,
                    ]);
                }

                $purchaseOrder->update([
                    ...$request->only([
                        'pr_reference', 'vendor_id', 'vendor_address_id', 'cost_center_id',
                        'bill_to_location_id', 'ship_to_location_id', 'po_valid_till',
                        'payment_terms_json', 'warranty_months', 'terms_conditions',
                    ]),
                    'freight' => $request->freight ?? 0,
                    'freight_gst_rate' => $request->freight_gst_rate ?? 0,
                    ...$totals,
                ]);

                return $purchaseOrder->fresh('items');
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'error' => 'Could not save the purchase order: ' . $e->getMessage(),
            ], 422);
        }

        return response()->json($po);
    }

    public function submit(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireTransactRole();
        $this->authorizePoAccess($purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return response()->json(['error' => 'Only draft POs can be submitted.'], 422);
        }

        if (!$purchaseOrder->cost_center_id) {
            return response()->json(['error' => 'A Cost Center must be selected before submitting.'], 422);
        }

        try {
            DB::transaction(function () use ($purchaseOrder) {
                $cc = $purchaseOrder->costCenter()->with('tenant')->first();
                $fiscalYear = $this->budget->currentFiscalYear($cc);

                // Generate PO number on first submission (draft has none)
                if (!$purchaseOrder->po_number) {
                    $poNumber = $this->poNumbers->generate($cc->tenant);
                    $purchaseOrder->update([
                        'po_number' => $poNumber,
                        'po_date'   => now()->toDateString(),
                    ]);
                }

                $this->budget->freeze(
                    $purchaseOrder->cost_center_id,
                    $fiscalYear,
                    $purchaseOrder->grand_total,
                    'PO',
                    $purchaseOrder->id,
                    auth()->id(),
                    "Budget frozen for PO submission"
                );

                $this->approval->routeForApproval($purchaseOrder);
                $this->actLog->log('PO', $purchaseOrder->id, 'submitted');
            });
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Submission failed: ' . $e->getMessage()], 422);
        }

        return response()->json($purchaseOrder->fresh());
    }

    public function release(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireTransactRole();
        $this->authorizePoAccess($purchaseOrder);

        if ($purchaseOrder->status !== 'approved') {
            return response()->json(['error' => 'Only approved POs can be released.'], 422);
        }

        $purchaseOrder->update([
            'status' => 'released',
            'released_at' => now(),
        ]);

        $this->tat->stamp($purchaseOrder->id, 'po_released_at', now());
        $this->actLog->log('PO', $purchaseOrder->id, 'released');

        // Issue the PO to the vendor by email (PO PDF attached). Non-fatal:
        // a missing vendor email or any mail error never blocks the release.
        $emailed = $this->emailPoToVendor($purchaseOrder);
        if ($emailed) {
            $this->actLog->log('PO', $purchaseOrder->id, 'emailed_to_vendor', [
                'email' => optional($purchaseOrder->vendor)->email,
            ]);
        }

        $fresh = $purchaseOrder->fresh();
        $fresh->setAttribute('emailed_to_vendor', $emailed);
        return response()->json($fresh);
    }

    /**
     * Manually (re-)send the PO to the vendor by email — used by the
     * "Send to Vendor" button, e.g. after adding the vendor's email address
     * or to re-issue the document.
     */
    public function sendToVendor(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireTransactRole();
        $this->authorizePoAccess($purchaseOrder);

        if (!in_array($purchaseOrder->status, ['approved', 'released', 'delivered', 'invoiced', 'payment_released'])) {
            return response()->json(['error' => 'Only approved or issued POs can be emailed to the vendor.'], 422);
        }

        $purchaseOrder->loadMissing('vendor');
        if (!optional($purchaseOrder->vendor)->email) {
            return response()->json(['error' => 'This vendor has no email address on file. Add one on the vendor record first.'], 422);
        }

        if (!$this->emailPoToVendor($purchaseOrder)) {
            return response()->json(['error' => 'Could not send the email. Please try again.'], 500);
        }

        $this->actLog->log('PO', $purchaseOrder->id, 'emailed_to_vendor', [
            'email' => $purchaseOrder->vendor->email,
        ]);

        return response()->json(['message' => "Purchase order emailed to {$purchaseOrder->vendor->email}."]);
    }

    /**
     * Queue the PO-issued email to the vendor. Returns false (without throwing)
     * when the vendor has no email or the mail layer errors, so callers in the
     * release flow are never blocked by mail problems.
     */
    private function emailPoToVendor(PurchaseOrder $po): bool
    {
        $po->loadMissing([
            'items.product', 'vendor', 'vendorAddress', 'costCenter', 'tenant',
            'billToLocation', 'shipToLocation',
        ]);

        $email = optional($po->vendor)->email;
        if (!$email) {
            return false;
        }

        try {
            Mail::to($email)->queue(new PurchaseOrderIssuedMail($po));
        } catch (\Throwable $e) {
            report($e);
            return false;
        }

        return true;
    }

    public function deliver(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireTransactRole();
        $this->authorizePoAccess($purchaseOrder);

        if ($purchaseOrder->status !== 'released') {
            return response()->json(['error' => 'Only released POs can be marked as delivered.'], 422);
        }

        $purchaseOrder->update([
            'status'       => 'delivered',
            'delivered_at' => now(),
        ]);

        $this->tat->stamp($purchaseOrder->id, 'po_delivered_at', now());
        $this->actLog->log('PO', $purchaseOrder->id, 'delivered');

        return response()->json($purchaseOrder->fresh());
    }

    /**
     * Super-admin tool: reset a non-draft PO back to draft, reversing all
     * lifecycle side effects (budget freeze, GRNs, invoices, approvals, TAT)
     * so the approval workflow can be re-run after (re)configuring approvers.
     */
    public function resetToDraft(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireRole('zopa_super_admin');
        $this->authorizePoAccess($purchaseOrder);

        if ($purchaseOrder->status === 'draft') {
            return response()->json(['error' => 'This PO is already a draft.'], 422);
        }

        app(\App\Services\PoResetService::class)->resetToDraft($purchaseOrder);

        return response()->json($purchaseOrder->fresh('items'));
    }

    /**
     * Super-admin diagnostic: shows which approval configs exist for a PO's cost center,
     * so we can understand why a PO auto-approved or got routed unexpectedly.
     */
    public function approvalDiagnostic(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireRole('zopa_super_admin');
        $this->authorizePoAccess($purchaseOrder);

        $po = $purchaseOrder->load('costCenter');

        // Every config on this PO's cost center (all types), with resolved approver IDs.
        $configs = \App\Models\ApprovalConfig::where('cost_center_id', $po->cost_center_id)
            ->orderBy('type')->orderBy('level')->get()
            ->map(fn ($c) => [
                'id'                 => $c->id,
                'type'               => $c->type,
                'level'              => $c->level,
                'is_active'          => $c->is_active,
                'amount_limit'       => $c->amount_limit,
                'user_id'            => $c->user_id,
                'user_ids'           => $c->user_ids,
                'resolved_user_ids'  => $c->resolved_user_ids,
            ]);

        // The exact set requiredPoConfigs() would return for this PO's amount.
        $poConfigs = \App\Models\ApprovalConfig::where('cost_center_id', $po->cost_center_id)
            ->where('type', 'po')->where('is_active', true)->orderBy('level')->get();
        $required = collect();
        foreach ($poConfigs as $c) {
            $required->push('L' . $c->level);
            if (is_null($c->amount_limit) || (float) $po->grand_total <= (float) $c->amount_limit) break;
        }

        // Actual approval records currently on this PO.
        $approvals = \App\Models\Approval::where('entity_type', 'PO')
            ->where('entity_id', $po->id)
            ->with('assignedTo:id,name,email')
            ->orderBy('level')->orderBy('id')
            ->get(['id', 'level', 'assigned_to_user_id', 'action', 'acted_at', 'created_at']);

        $poConfigCount = $poConfigs->count();
        $verdict = $poConfigCount === 0
            ? '❌ NO active PO approval config on this cost center → routeForApproval auto-approves. '
              . 'The L1 approver you set was NOT saved against THIS cost center + type=po.'
            : '✅ ' . $poConfigCount . ' active PO config(s) found → this PO SHOULD route to '
              . $required->implode(' → ') . ', not auto-approve.';

        return response()->json([
            'po_id'            => $po->id,
            'po_number'        => $po->po_number,
            'po_status'        => $po->status,
            'cost_center_id'   => $po->cost_center_id,
            'cost_center_name' => $po->costCenter?->name,
            'grand_total'      => $po->grand_total,
            'VERDICT'          => $verdict,
            'would_route_to'   => $required->values(),
            'configs_for_this_cost_center' => $configs,
            'approval_records_on_this_po'  => $approvals,
        ]);
    }

    public function releasePayment(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireAdminRole();   // financial action — admin only
        $this->authorizePoAccess($purchaseOrder);

        if ($purchaseOrder->status !== 'invoiced') {
            return response()->json(['error' => 'Only invoiced POs can have payment released.'], 422);
        }

        $purchaseOrder->update([
            'status'               => 'payment_released',
            'payment_released_at'  => now(),
        ]);

        $this->actLog->log('PO', $purchaseOrder->id, 'payment_released');

        return response()->json($purchaseOrder->fresh());
    }

    public function upload(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->requireTransactRole();
        $request->validate(['file' => 'required|file|max:10240']);
        $this->authorizePoAccess($purchaseOrder);

        $path = $request->file('file')->store("po-attachments/{$purchaseOrder->id}", 'local');

        $attachment = PoAttachment::create([
            'po_id' => $purchaseOrder->id,
            'name' => pathinfo($request->file('file')->getClientOriginalName(), PATHINFO_FILENAME),
            'original_name' => $request->file('file')->getClientOriginalName(),
            'file_path' => $path,
            'size' => $request->file('file')->getSize(),
            'uploaded_by' => auth()->id(),
        ]);

        return response()->json($attachment, 201);
    }

    public function pdf(PurchaseOrder $purchaseOrder): Response
    {
        $this->authorizePoAccess($purchaseOrder);
        $po = $purchaseOrder->load(['items.product', 'vendor', 'vendorAddress', 'costCenter.department', 'costCenter.project', 'costCenter.location', 'approvals.assignedTo', 'billToLocation', 'shipToLocation', 'tenant', 'creator', 'approver']);

        $pdf = Pdf::loadView('pdf.purchase-order', compact('po'))->setPaper('a4');

        // PO numbers can contain '/' (from the org code) — Symfony rejects '/'
        // and '\' in a Content-Disposition filename, so sanitise before streaming.
        $safeNo = str_replace(['/', '\\'], '-', (string) ($po->po_number ?: $po->id));
        return $pdf->stream("PO-{$safeNo}.pdf");
    }

    /**
     * Issue a short-lived single-use token URL for unauthenticated PDF download.
     * This solves the browser file-download Authorization-header problem.
     */
    public function pdfUrl(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorizePoAccess($purchaseOrder);

        $token = bin2hex(random_bytes(32));
        \Cache::put("pdf_dl_{$token}", [
            'po_id'     => $purchaseOrder->id,
            'tenant_id' => $purchaseOrder->tenant_id,
        ], now()->addMinutes(5));

        return response()->json([
            'url' => url("/api/po-pdf/{$purchaseOrder->id}") . '?token=' . $token,
        ]);
    }

    /**
     * Unauthenticated PDF download using a one-time cache token.
     * Route uses a plain integer {id} — NO route-model binding — so no middleware
     * or Eloquent global-scope can fire before we validate the token.
     */
    public function pdfByToken(int $id, \Illuminate\Http\Request $request): Response
    {
        $token = (string) $request->query('token', '');
        $data  = \Cache::pull("pdf_dl_{$token}");   // single-use: consumed on first read

        abort_if(!$data, 403, 'Invalid or expired download link.');
        abort_if((int) $data['po_id'] !== $id, 403, 'Token / PO mismatch.');

        // Lookup the PO manually — after token is validated
        $purchaseOrder = PurchaseOrder::find($id);
        abort_if(!$purchaseOrder, 404, 'Purchase order not found.');
        abort_if((int) $data['tenant_id'] !== $purchaseOrder->tenant_id, 403, 'Tenant mismatch.');

        $po = $purchaseOrder->load([
            'items.product', 'vendor', 'vendorAddress',
            'costCenter.department', 'costCenter.project', 'costCenter.location',
            'approvals.assignedTo', 'billToLocation', 'shipToLocation', 'tenant',
            'creator', 'approver',
        ]);

        $pdf = Pdf::loadView('pdf.purchase-order', compact('po'))->setPaper('a4');

        // PO numbers can contain '/' (from the org code) — Symfony rejects '/'
        // and '\' in a Content-Disposition filename, so sanitise before streaming.
        $safeNo = str_replace(['/', '\\'], '-', (string) ($po->po_number ?: $po->id));
        return $pdf->stream("PO-{$safeNo}.pdf");
    }

    private function authorizePoAccess(PurchaseOrder $po): void
    {
        $tenant = app('currentTenant');
        abort_if($po->tenant_id !== $tenant->id, 403);
    }
}
