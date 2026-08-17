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
        try {
            $tenant = app('currentTenant');
            $tenantId = $tenant->id;

            // Use plain DB query first to get IDs — avoids any model cast issues
            $query = PurchaseRequisition::with([
                'requestedBy:id,name',
                'costCenter:id,name',
                'project:id,name',
                'location:id,name',
            ])->withCount('purchaseOrders')->where('tenant_id', $tenantId);

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }
            if ($request->filled('requested_by')) {
                $query->where('requested_by', $request->input('requested_by'));
            }

            // Hide drafts from non-transact roles (like Approvers)
            if (!$this->hasTransactRole()) {
                $query->where('status', '!=', 'draft');
            }

            $perPage = min((int) ($request->input('per_page', 500)), 1000);
            return response()->json($query->latest()->paginate($perPage));

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('PR index 500: ' . $e->getMessage(), [
                'tenant' => app()->bound('currentTenant') ? app('currentTenant')->id : 'none',
                'line' => $e->getLine(),
                'file' => basename($e->getFile()),
            ]);
            return response()->json([
                'error'   => $e->getMessage(),
                'at_line' => $e->getLine(),
                'in_file' => basename($e->getFile()),
            ], 500);
        }
    }

    public function export(Request $request)
    {
        $tenant = app('currentTenant');
        $ccIds = \App\Models\CostCenter::where('tenant_id', $tenant->id)->pluck('id');

        $query = PurchaseRequisition::with(['requestedBy:id,name', 'costCenter:id,name'])
            ->where(function ($q) use ($tenant, $ccIds) {
                $q->where('tenant_id', $tenant->id)
                  ->orWhereIn('cost_center_id', $ccIds);
            });

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('requested_by')) {
            $query->where('requested_by', $request->requested_by);
        }
        if (!$this->hasTransactRole()) {
            $query->where('status', '!=', 'draft');
        }

        $data = $query->latest()->get()->map(function ($pr) {
            $isConverted = !empty($pr->converted_at) || ($pr->purchase_orders_count ?? 0) > 0 || in_array($pr->status, ['converted', 'partially_converted']);
            $statusText = ucfirst(str_replace('_', ' ', $pr->status));
            if (in_array($pr->status, ['short_closed', 'short_close_pending_l1', 'short_close_pending_l2', 'short_close_pending_l3']) && $isConverted) {
                $statusText = 'Converted & Short Closed';
            }
            return [
                'PR Number' => $pr->pr_number ?? 'Draft',
                'Title' => $pr->title,
                'Requested By' => optional($pr->requestedBy)->name,
                'Cost Center' => optional($pr->costCenter)->name,
                'Estimated Amount' => $pr->estimated_amount,
                'Status' => $statusText,
                'Created At' => $pr->created_at->format('Y-m-d'),
            ];
        });

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\GenericExport($data, ['PR Number', 'Title', 'Requested By', 'Cost Center', 'Estimated Amount', 'Status', 'Created At']),
            'purchase_requisitions.xlsx'
        );
    }

    public function store(Request $request): JsonResponse
    {
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
                'clarifications.requester:id,name',
                'clarifications.responder:id,name',
                'statusUpdates.sentBy:id,name,email',
            ])
        );
    }


    public function update(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
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
            $estimated = null;
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
                    $estimated += ($item['qty'] * ($item['estimated_price'] ?? 0));
                }
            }

            $updateData = $request->only('title', 'cost_center_id', 'project_id', 'location_id', 'priority', 'required_by_date', 'required_by_person', 'description');
            if ($estimated !== null) {
                $updateData['estimated_amount'] = $estimated;
            }
            $purchaseRequisition->update($updateData);
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

    public function shortClose(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        try {
            $this->requireTransactRole();
            $this->authorize($purchaseRequisition);

            if (in_array($purchaseRequisition->status, ['draft', 'short_closed', 'rejected'])) {
                return response()->json(['error' => 'PR cannot be short-closed in its current state.'], 422);
            }

            $request->validate([
                'reason' => 'required|string|max:1000',
            ]);

            // Safely update only columns that exist — guard against missing migration columns
            $updateData = ['status' => $purchaseRequisition->status]; // no-op default
            if (\Illuminate\Support\Facades\Schema::hasColumn('purchase_requisitions', 'short_close_reason')) {
                $updateData = [
                    'short_close_reason' => $request->input('reason'),
                    'short_closed_by'    => auth()->id(),
                ];
                $purchaseRequisition->update($updateData);
            }

            $this->approval->routePrShortCloseForApproval($purchaseRequisition, $request->input('reason'), auth()->id());
            $this->actLog->log('PR', $purchaseRequisition->id, 'short_close_requested', [
                'reason' => $request->input('reason'),
            ]);

            return response()->json($purchaseRequisition->fresh());
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('PR shortClose 500: ' . $e->getMessage(), [
                'pr_id' => $purchaseRequisition->id ?? null,
                'line'  => $e->getLine(),
                'file'  => basename($e->getFile()),
            ]);
            return response()->json([
                'error'   => $e->getMessage(),
                'at_line' => $e->getLine(),
                'in_file' => basename($e->getFile()),
            ], 500);
        }
    }

    public function destroy(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->authorize($purchaseRequisition);

        if ($purchaseRequisition->status !== 'draft') {
            return response()->json(['error' => 'Only draft PRs can be deleted.'], 422);
        }

        if ($purchaseRequisition->requested_by !== auth()->id() && !$this->can('purchase_requisitions', 'delete') && !$this->canTransact()) {
            return response()->json(['error' => 'You do not have permission to delete this PR.'], 403);
        }

        $purchaseRequisition->items()->delete();
        $purchaseRequisition->delete();
        return response()->json(['message' => 'Draft PR deleted successfully.'], 200);
    }

    public function cleanupDrafts(Request $request): JsonResponse
    {
        $tenant = app('currentTenant');
        $query = PurchaseRequisition::where('tenant_id', $tenant->id)->where('status', 'draft');

        if ($request->has('today')) {
            $query->whereDate('created_at', now()->toDateString());
        }

        $prs = $query->get();
        $count = $prs->count();

        foreach ($prs as $pr) {
            $pr->items()->delete();
            $pr->delete();
        }

        return response()->json(['message' => "Cleaned up {$count} draft PRs.", 'deleted_count' => $count]);
    }

    /**
     * Activity timeline for this PR.
     */
    public function activities(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->authorize($purchaseRequisition);
        return response()->json($this->actLog->forEntity('PR', $purchaseRequisition->id));
    }

    /**
     * Request clarification on a PR (Buyer / Procurement User).
     */
    public function requestClarification(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->authorize($purchaseRequisition);
        $this->requireTransactRole();

        $request->validate([
            'notes' => 'required|string|max:2000',
        ]);

        if (in_array($purchaseRequisition->status, ['draft', 'short_closed', 'rejected'])) {
            return response()->json(['error' => 'Cannot request clarification on draft, short-closed, or rejected PRs.'], 422);
        }

        $now = now();
        $purchaseRequisition->update([
            'status'                     => 'needs_clarification',
            'needs_clarification'        => true,
            'clarification_requested_at' => $now,
            'clarification_requested_by' => auth()->id(),
        ]);

        $requestAttachments = $this->processClarificationFiles($request, $purchaseRequisition->id);

        $clarification = \App\Models\PrClarification::create([
            'tenant_id'           => $purchaseRequisition->tenant_id,
            'pr_id'               => $purchaseRequisition->id,
            'requested_by'        => auth()->id(),
            'request_notes'       => trim($request->notes),
            'request_attachments' => count($requestAttachments) > 0 ? $requestAttachments : null,
            'requested_at'        => $now,
            'status'              => 'pending',
        ]);

        // Stamp TAT record
        $this->tat->stampPr($purchaseRequisition->id, 'clarification_requested_at', $now);

        // Send email notification to the PR raiser
        $prRaiserEmail = optional($purchaseRequisition->requestedBy)->email ?? optional(\App\Models\User::find($purchaseRequisition->requested_by))->email;
        if ($prRaiserEmail) {
            try {
                \Illuminate\Support\Facades\Mail::to($prRaiserEmail)->queue(
                    new \App\Mail\DocumentStatusMail('PR', $purchaseRequisition, 'needs_clarification', trim($request->notes))
                );
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('Failed to send clarification request email: ' . $e->getMessage());
            }
        }

        // Activity log
        $this->actLog->log('PR', $purchaseRequisition->id, 'clarification_requested', [
            'pr_number'           => $purchaseRequisition->pr_number,
            'request_notes'       => trim($request->notes),
            'request_attachments' => $requestAttachments,
            'requested_by'        => auth()->user()->name ?? auth()->id(),
        ]);

        return response()->json([
            'message'       => 'Clarification request logged successfully.',
            'pr'            => $purchaseRequisition->fresh(['clarifications.requester', 'clarifications.responder']),
            'clarification' => $clarification->load('requester:id,name'),
        ]);
    }

    /**
     * Provide clarification / answer notes on a PR (Requester / Creator / Buyer).
     */
    public function provideClarification(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->authorize($purchaseRequisition);

        $request->validate([
            'response_notes' => 'required|string|max:2000',
            'status'         => 'nullable|string|in:submitted,approved',
        ]);

        $now = now();
        $activeClarification = \App\Models\PrClarification::where('pr_id', $purchaseRequisition->id)
            ->where('status', 'pending')
            ->latest()
            ->first();

        $responseAttachments = $this->processClarificationFiles($request, $purchaseRequisition->id);

        $durationSec = 0;
        if ($activeClarification) {
            $durationSec = max(0, $now->diffInSeconds($activeClarification->requested_at));
            $activeClarification->update([
                'provided_by'           => auth()->id(),
                'response_notes'        => trim($request->response_notes),
                'response_attachments'  => count($responseAttachments) > 0 ? $responseAttachments : null,
                'provided_at'           => $now,
                'duration_seconds'      => $durationSec,
                'status'                => 'resolved',
            ]);
        }

        $newTotalDuration = ($purchaseRequisition->total_clarification_duration_seconds ?? 0) + $durationSec;
        $targetStatus = $request->status ?? ($purchaseRequisition->converted_at ? 'partially_converted' : 'submitted');

        $purchaseRequisition->update([
            'status'                               => $targetStatus,
            'needs_clarification'                  => false,
            'clarification_provided_at'            => $now,
            'clarification_provided_by'            => auth()->id(),
            'total_clarification_duration_seconds' => $newTotalDuration,
        ]);

        // Stamp TAT record
        $this->tat->stampPr($purchaseRequisition->id, 'clarification_provided_at', $now);
        $this->tat->stampPr($purchaseRequisition->id, 'clarification_duration_seconds', $newTotalDuration);


        // Activity log
        $this->actLog->log('PR', $purchaseRequisition->id, 'clarification_provided', [
            'pr_number'            => $purchaseRequisition->pr_number,
            'response_notes'       => trim($request->response_notes),
            'response_attachments' => $responseAttachments,
            'duration_seconds'     => $durationSec,
            'provided_by'          => auth()->user()->name ?? auth()->id(),
        ]);

        return response()->json([
            'message' => 'Clarification response submitted successfully.',
            'pr'      => $purchaseRequisition->fresh(['clarifications.requester', 'clarifications.responder']),
        ]);
    }

    public function downloadClarificationAttachment(Request $request, PurchaseRequisition $purchaseRequisition)
    {
        $this->authorize($purchaseRequisition);
        $path = $request->query('path');
        if (!$path || !\Illuminate\Support\Facades\Storage::disk('local')->exists($path)) {
            abort(404, 'Attachment file not found');
        }

        return \Illuminate\Support\Facades\Storage::disk('local')->download($path);
    }

    private function processClarificationFiles(Request $request, int $prId): array
    {
        $uploadedFiles = [];
        if ($request->hasFile('file')) {
            $uploadedFiles[] = $request->file('file');
        } elseif ($request->hasFile('files')) {
            $files = $request->file('files');
            $uploadedFiles = is_array($files) ? $files : [$files];
        }

        $attachments = [];
        foreach ($uploadedFiles as $file) {
            if (!$file->isValid()) {
                continue;
            }
            if ($file->getSize() > 10240 * 1024) {
                continue;
            }

            $path = $file->store("clarification-attachments/pr-{$prId}", 'local');
            $attachments[] = [
                'name'          => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'original_name' => $file->getClientOriginalName(),
                'file_path'     => $path,
                'size'          => $file->getSize(),
                'uploaded_at'   => now()->toIso8601String(),
            ];
        }

        return $attachments;
    }

    /**
     * Send PR Status Update to PR Raiser and CC stakeholders (Buyer action).
     */
    public function sendStatusUpdate(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->authorize($purchaseRequisition);
        $this->requireTransactRole();

        $request->validate([
            'message'   => 'required|string|max:4000',
            'cc_emails' => 'nullable',
        ]);

        // Parse CC emails (array or comma-separated string)
        $rawCc = $request->input('cc_emails');
        $ccEmails = [];
        if (is_array($rawCc)) {
            $ccEmails = array_filter(array_map('trim', $rawCc), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
        } elseif (is_string($rawCc) && trim($rawCc) !== '') {
            $parts = explode(',', $rawCc);
            foreach ($parts as $p) {
                $trimmed = trim($p);
                if (filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
                    $ccEmails[] = $trimmed;
                }
            }
        }
        $ccEmails = array_values(array_unique($ccEmails));

        // Process attachments
        $attachments = $this->processStatusUpdateFiles($request, $purchaseRequisition->id);

        $update = \App\Models\PrStatusUpdate::create([
            'tenant_id'   => $purchaseRequisition->tenant_id,
            'pr_id'       => $purchaseRequisition->id,
            'sent_by'     => auth()->id(),
            'message'     => trim($request->message),
            'cc_emails'   => count($ccEmails) > 0 ? $ccEmails : null,
            'attachments' => count($attachments) > 0 ? $attachments : null,
        ]);

        // Send Email to PR Raiser and CC recipients
        $prRaiserEmail = optional($purchaseRequisition->requestedBy)->email ?? optional(\App\Models\User::find($purchaseRequisition->requested_by))->email;
        if ($prRaiserEmail) {
            try {
                \Illuminate\Support\Facades\Mail::to($prRaiserEmail)->queue(
                    new \App\Mail\PrStatusUpdateMail($purchaseRequisition, trim($request->message), auth()->user(), $ccEmails)
                );
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('Failed to send PR status update email: ' . $e->getMessage());
            }
        }

        // Log Activity
        $this->actLog->log('PR', $purchaseRequisition->id, 'pr_status_update', [
            'pr_number'   => $purchaseRequisition->pr_number,
            'message'     => trim($request->message),
            'cc_emails'   => $ccEmails,
            'attachments' => $attachments,
            'sent_by'     => auth()->user()->name ?? auth()->id(),
        ]);

        return response()->json([
            'message'       => 'PR Status Update sent successfully.',
            'status_update' => $update->load('sentBy:id,name,email'),
            'pr'            => $purchaseRequisition->fresh(['statusUpdates.sentBy', 'clarifications.requester']),
        ]);
    }

    public function downloadStatusUpdateAttachment(Request $request, PurchaseRequisition $purchaseRequisition)
    {
        $this->authorize($purchaseRequisition);
        $path = $request->query('path');
        if (!$path || !\Illuminate\Support\Facades\Storage::disk('local')->exists($path)) {
            abort(404, 'Attachment file not found');
        }

        return \Illuminate\Support\Facades\Storage::disk('local')->download($path);
    }

    private function processStatusUpdateFiles(Request $request, int $prId): array
    {
        $uploadedFiles = [];
        if ($request->hasFile('file')) {
            $uploadedFiles[] = $request->file('file');
        } elseif ($request->hasFile('files')) {
            $files = $request->file('files');
            $uploadedFiles = is_array($files) ? $files : [$files];
        }

        $attachments = [];
        foreach ($uploadedFiles as $file) {
            if (!$file->isValid()) continue;
            if ($file->getSize() > 10240 * 1024) continue;

            $path = $file->store("status-update-attachments/pr-{$prId}", 'local');
            $attachments[] = [
                'name'          => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'original_name' => $file->getClientOriginalName(),
                'file_path'     => $path,
                'size'          => $file->getSize(),
                'uploaded_at'   => now()->toIso8601String(),
            ];
        }

        return $attachments;
    }

    private function authorize(PurchaseRequisition $pr): void
    {
        abort_if($pr->tenant_id !== app('currentTenant')->id, 403);
    }
}

