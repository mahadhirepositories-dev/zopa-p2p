<?php

namespace App\Http\Controllers;

use App\Exports\GenericExport;
use App\Models\Category;
use App\Models\Location;
use App\Models\PrItem;
use App\Models\Product;
use App\Models\PurchaseRequisition;
use App\Models\SourcingRemark;
use App\Models\SourcingRequest;
use App\Models\SourcingVendorContact;
use App\Models\Tenant;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SourcingController extends Controller
{
    use AuthorizesRoles;

    /**
     * Check if the authenticated user is ZOPA staff / super admin / internal buyer.
     */
    private function requireZopaBuyerOrStaff(): void
    {
        $user = auth()->user();
        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        // Allow if user is marked as ZOPA staff, super admin, or has ZOPA buyer role
        $currentRole = app()->bound('currentRole') ? app('currentRole') : null;
        $isZopaRole = in_array($currentRole, [
            'zopa_super_admin', 'zopa_buyer', 'zopa_approver_l1', 'zopa_approver_l2', 'zopa_approver_l3', 'zopa_pr', 'zopa_grn'
        ]);

        if (!$user->is_zopa_staff && !$isZopaRole) {
            abort(403, 'The Sourcing module is only accessible to ZOPA Internal Organization.');
        }
    }

    /**
     * List all sourcing requests across organizations with stats and filters.
     */
    public function index(Request $request): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $query = SourcingRequest::with([
            'creator:id,name,email',
            'closedBy:id,name',
            'tenant:id,name,code',
            'category:id,name',
            'location:id,name',
            'vendorContacts.creator:id,name',
            'remarks.user:id,name',
        ]);

        // Status Filter
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Source Type Filter
        if ($request->filled('source_type') && $request->source_type !== 'all') {
            $query->where('source_type', $request->source_type);
        }

        // Client / Organization Filter
        if ($request->filled('tenant_id') && $request->tenant_id !== 'all') {
            $query->where('tenant_id', $request->tenant_id);
        }

        // Search Filter
        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('sourcing_number', 'LIKE', "%{$s}%")
                  ->orWhere('item_name', 'LIKE', "%{$s}%")
                  ->orWhere('specification', 'LIKE', "%{$s}%")
                  ->orWhere('pr_ref', 'LIKE', "%{$s}%")
                  ->orWhere('rfq_ref', 'LIKE', "%{$s}%")
                  ->orWhere('client_name', 'LIKE', "%{$s}%")
                  ->orWhere('delivery_location', 'LIKE', "%{$s}%")
                  ->orWhereHas('vendorContacts', function ($vq) use ($s) {
                      $vq->where('vendor_name', 'LIKE', "%{$s}%")
                         ->orWhere('contact_person', 'LIKE', "%{$s}%")
                         ->orWhere('phone', 'LIKE', "%{$s}%")
                         ->orWhere('email', 'LIKE', "%{$s}%");
                  })
                  ->orWhereHas('remarks', function ($rq) use ($s) {
                      $rq->where('remark', 'LIKE', "%{$s}%");
                  });
            });
        }

        $requests = $query->orderBy('created_at', 'desc')->get();

        // Calculate Stats
        $all = SourcingRequest::all();
        $stats = [
            'total'   => $all->count(),
            'open'    => $all->where('status', 'open')->count(),
            'closed'  => $all->where('status', 'closed')->count(),
            'from_pr' => $all->where('source_type', 'pr')->count(),
            'direct'  => $all->where('source_type', 'direct')->count(),
        ];

        return response()->json([
            'data'  => $requests,
            'stats' => $stats,
        ]);
    }

    /**
     * Fetch PR line items across ALL organizations for sourcing selection.
     */
    public function prLineItems(Request $request): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $query = PrItem::with([
            'pr.tenant:id,name,code',
            'pr.location:id,name',
            'pr.costCenter:id,name',
            'product:id,name,code,category_id',
            'category:id,name',
        ])
        ->whereHas('pr', function ($q) {
            $q->whereNotIn('status', ['draft', 'rejected', 'short_closed']);
        });

        // Filter by specific client if requested
        if ($request->filled('tenant_id') && $request->tenant_id !== 'all') {
            $query->whereHas('pr', function ($q) use ($request) {
                $q->where('tenant_id', $request->tenant_id);
            });
        }

        // Filter by unpriced only
        if ($request->boolean('unpriced_only')) {
            $query->where(function ($q) {
                $q->whereNull('estimated_price')
                  ->orWhere('estimated_price', '<=', 0);
            });
        }

        // Search term
        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('description', 'LIKE', "%{$s}%")
                  ->orWhereHas('pr', function ($prQ) use ($s) {
                      $prQ->where('pr_number', 'LIKE', "%{$s}%")
                          ->orWhere('pr_ref', 'LIKE', "%{$s}%")
                          ->orWhere('title', 'LIKE', "%{$s}%")
                          ->orWhereHas('tenant', function ($tQ) use ($s) {
                              $tQ->where('name', 'LIKE', "%{$s}%");
                          });
                  });
            });
        }

        $items = $query->orderBy('id', 'desc')->paginate(50);

        return response()->json($items);
    }

    /**
     * Create a direct Sourcing Request or from PR.
     */
    public function store(Request $request): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $validated = $request->validate([
            'source_type'        => 'required|in:direct,pr',
            'item_name'          => 'required|string|max:255',
            'specification'      => 'nullable|string',
            'category_id'        => 'nullable|exists:categories,id',
            'category_name'      => 'nullable|string|max:150',
            'qty'                => 'required|numeric|min:0.001',
            'unit'               => 'nullable|string|max:50',
            'target_price'       => 'nullable|numeric|min:0',
            'tenant_id'          => 'nullable|exists:tenants,id',
            'client_name'        => 'nullable|string|max:150',
            'location_id'        => 'nullable|exists:locations,id',
            'delivery_location'  => 'nullable|string|max:255',
            'rfq_ref'            => 'nullable|string|max:100',
            'pr_id'              => 'nullable|exists:purchase_requisitions,id',
            'pr_item_id'         => 'nullable|exists:pr_items,id',
            'pr_ref'             => 'nullable|string|max:100',
            // Optional initial vendor contact
            'vendor_name'        => 'nullable|string|max:255',
            'contact_person'     => 'nullable|string|max:150',
            'phone'              => 'nullable|string|max:50',
            'email'              => 'nullable|string|max:150',
            'quoted_price'       => 'nullable|numeric|min:0',
            'payment_terms'      => 'nullable|string|max:255',
            'vendor_notes'       => 'nullable|string',
            // Optional initial working remark
            'initial_remark'     => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $user = auth()->user();

            // Resolve Category Name if category_id given
            $categoryName = $validated['category_name'] ?? null;
            if (!empty($validated['category_id']) && empty($categoryName)) {
                $category = Category::find($validated['category_id']);
                $categoryName = $category?->name;
            }

            // Resolve Client Name if tenant_id given
            $clientName = $validated['client_name'] ?? null;
            if (!empty($validated['tenant_id']) && empty($clientName)) {
                $tenant = Tenant::find($validated['tenant_id']);
                $clientName = $tenant?->name;
            }

            // Resolve Delivery Location if location_id given
            $deliveryLocation = $validated['delivery_location'] ?? null;
            if (!empty($validated['location_id']) && empty($deliveryLocation)) {
                $loc = Location::find($validated['location_id']);
                $deliveryLocation = $loc?->name;
            }

            // Resolve PR info if pr_id given
            $prRef = $validated['pr_ref'] ?? null;
            if (!empty($validated['pr_id']) && empty($prRef)) {
                $pr = PurchaseRequisition::find($validated['pr_id']);
                $prRef = $pr?->pr_number ?: $pr?->pr_ref;
                if (empty($clientName) && $pr?->tenant) {
                    $clientName = $pr->tenant->name;
                }
                if (empty($validated['tenant_id']) && $pr) {
                    $validated['tenant_id'] = $pr->tenant_id;
                }
            }

            $sourcing = SourcingRequest::create([
                'source_type'       => $validated['source_type'],
                'item_name'         => $validated['item_name'],
                'product_id'        => $validated['product_id'] ?? null,
                'specification'     => $validated['specification'] ?? null,
                'category_id'       => $validated['category_id'] ?? null,
                'category_name'     => $categoryName,
                'qty'               => $validated['qty'],
                'unit'              => $validated['unit'] ?: 'Nos',
                'target_price'      => $validated['target_price'] ?? null,
                'tenant_id'         => $validated['tenant_id'] ?? null,
                'client_name'       => $clientName,
                'location_id'       => $validated['location_id'] ?? null,
                'delivery_location' => $deliveryLocation,
                'rfq_ref'           => $validated['rfq_ref'] ?? null,
                'pr_id'             => $validated['pr_id'] ?? null,
                'pr_item_id'        => $validated['pr_item_id'] ?? null,
                'pr_ref'            => $prRef,
                'status'            => 'open',
                'created_by'        => $user->id,
            ]);

            // Add initial vendor contact if provided
            if (!empty($validated['vendor_name'])) {
                SourcingVendorContact::create([
                    'sourcing_request_id' => $sourcing->id,
                    'vendor_name'         => $validated['vendor_name'],
                    'contact_person'      => $validated['contact_person'] ?? null,
                    'phone'               => $validated['phone'] ?? null,
                    'email'               => $validated['email'] ?? null,
                    'quoted_price'        => $validated['quoted_price'] ?? null,
                    'payment_terms'       => $validated['payment_terms'] ?? null,
                    'notes'               => $validated['vendor_notes'] ?? null,
                    'created_by'          => $user->id,
                ]);
            }

            // Add initial working remark if provided
            if (!empty($validated['initial_remark'])) {
                SourcingRemark::create([
                    'sourcing_request_id' => $sourcing->id,
                    'user_id'             => $user->id,
                    'remark'              => $validated['initial_remark'],
                ]);
            }

            return response()->json([
                'message' => 'Sourcing request created successfully.',
                'data'    => $sourcing->load(['vendorContacts', 'remarks.user:id,name', 'creator:id,name']),
            ], 201);
        });
    }

    /**
     * Batch create sourcing requests from PR Line items.
     */
    public function fromPrItems(Request $request): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.pr_id'         => 'required|exists:purchase_requisitions,id',
            'items.*.pr_item_id'    => 'required|exists:pr_items,id',
            'items.*.description'   => 'required|string',
            'items.*.qty'           => 'required|numeric|min:0.001',
            'items.*.unit'          => 'nullable|string',
            'items.*.category_id'   => 'nullable|exists:categories,id',
            'items.*.rfq_ref'       => 'nullable|string',
            'items.*.remarks'       => 'nullable|string',
        ]);

        $created = [];
        $user = auth()->user();

        DB::transaction(function () use ($validated, $user, &$created) {
            foreach ($validated['items'] as $item) {
                $pr = PurchaseRequisition::with(['tenant', 'location'])->find($item['pr_id']);
                $prItem = PrItem::with('product')->find($item['pr_item_id']);

                $sourcing = SourcingRequest::create([
                    'source_type'       => 'pr',
                    'pr_id'             => $pr->id,
                    'pr_item_id'        => $prItem?->id,
                    'pr_ref'            => $pr->pr_number ?: $pr->pr_ref,
                    'rfq_ref'           => $item['rfq_ref'] ?? null,
                    'item_name'         => $item['description'],
                    'product_id'        => $prItem?->product_id,
                    'specification'     => $prItem?->description !== $item['description'] ? $prItem?->description : null,
                    'category_id'       => $item['category_id'] ?? $prItem?->category_id,
                    'category_name'     => $prItem?->category?->name,
                    'qty'               => $item['qty'],
                    'unit'              => $item['unit'] ?? $prItem?->unit ?? 'Nos',
                    'target_price'      => $prItem?->estimated_price > 0 ? $prItem->estimated_price : null,
                    'tenant_id'         => $pr->tenant_id,
                    'client_name'       => $pr->tenant?->name,
                    'location_id'       => $pr->location_id,
                    'delivery_location' => $pr->location?->name,
                    'status'            => 'open',
                    'created_by'        => $user->id,
                ]);

                if (!empty($item['remarks'])) {
                    SourcingRemark::create([
                        'sourcing_request_id' => $sourcing->id,
                        'user_id'             => $user->id,
                        'remark'              => $item['remarks'],
                    ]);
                }

                $created[] = $sourcing;
            }
        });

        return response()->json([
            'message' => count($created) . ' item(s) sent to Sourcing successfully.',
            'data'    => $created,
        ], 201);
    }

    /**
     * Show detailed Sourcing Request.
     */
    public function show(int $id): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::with([
            'creator:id,name,email',
            'closedBy:id,name',
            'tenant:id,name,code',
            'category:id,name',
            'location:id,name',
            'pr:id,pr_number,title,status,tenant_id',
            'vendorContacts.creator:id,name',
            'vendorContacts.updater:id,name',
            'remarks.user:id,name',
        ])->findOrFail($id);

        return response()->json($sourcing);
    }

    /**
     * Update Sourcing Request.
     * Core item details: Creator or Super Admin only.
     * Status change: Any buyer / creator / admin.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::findOrFail($id);
        $user = auth()->user();
        $isCreatorOrAdmin = ($sourcing->created_by === $user->id) || $user->is_zopa_staff;

        $validated = $request->validate([
            'item_name'          => 'sometimes|required|string|max:255',
            'specification'      => 'nullable|string',
            'category_id'        => 'nullable|exists:categories,id',
            'category_name'      => 'nullable|string|max:150',
            'qty'                => 'sometimes|required|numeric|min:0.001',
            'unit'               => 'nullable|string|max:50',
            'target_price'       => 'nullable|numeric|min:0',
            'tenant_id'          => 'nullable|exists:tenants,id',
            'client_name'        => 'nullable|string|max:150',
            'location_id'        => 'nullable|exists:locations,id',
            'delivery_location'  => 'nullable|string|max:255',
            'rfq_ref'            => 'nullable|string|max:100',
            'status'             => 'sometimes|required|in:open,closed',
            'closure_notes'      => 'nullable|string',
        ]);

        // If core item fields are being modified, ensure user is creator or admin
        $coreFields = ['item_name', 'specification', 'category_id', 'qty', 'unit', 'target_price', 'tenant_id', 'client_name', 'location_id', 'delivery_location', 'rfq_ref'];
        $hasCoreChange = false;
        foreach ($coreFields as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] != $sourcing->$field) {
                $hasCoreChange = true;
                break;
            }
        }

        if ($hasCoreChange && !$isCreatorOrAdmin) {
            return response()->json([
                'error' => 'Core item details can only be edited by the creator of this sourcing request.'
            ], 403);
        }

        // Status update logic
        if (isset($validated['status'])) {
            if ($validated['status'] === 'closed' && $sourcing->status !== 'closed') {
                $sourcing->closed_at = now();
                $sourcing->closed_by = $user->id;
                $sourcing->closure_notes = $validated['closure_notes'] ?? null;
            } elseif ($validated['status'] === 'open' && $sourcing->status !== 'open') {
                $sourcing->closed_at = null;
                $sourcing->closed_by = null;
            }
        }

        $sourcing->fill($validated);
        $sourcing->save();

        return response()->json([
            'message' => 'Sourcing request updated successfully.',
            'data'    => $sourcing->fresh([
                'creator:id,name,email',
                'closedBy:id,name',
                'vendorContacts.creator:id,name',
                'remarks.user:id,name',
            ]),
        ]);
    }

    /**
     * Delete Sourcing Request (Creator or Admin).
     */
    public function destroy(int $id): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::findOrFail($id);
        $user = auth()->user();

        if ($sourcing->created_by !== $user->id && !$user->is_zopa_staff) {
            return response()->json(['error' => 'Only the creator can delete this sourcing request.'], 403);
        }

        $sourcing->delete();

        return response()->json(['message' => 'Sourcing request deleted successfully.']);
    }

    /**
     * Add a Vendor Contact / Quote (Collaborative: ANY ZOPA Buyer).
     */
    public function addContact(Request $request, int $id): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::findOrFail($id);

        $validated = $request->validate([
            'vendor_id'       => 'nullable|exists:vendors,id',
            'vendor_name'     => 'required|string|max:255',
            'contact_person'  => 'nullable|string|max:150',
            'phone'           => 'nullable|string|max:50',
            'email'           => 'nullable|string|max:150',
            'quoted_price'    => 'nullable|numeric|min:0',
            'gst_rate'        => 'nullable|numeric|min:0|max:100',
            'lead_time_days'  => 'nullable|integer|min:0',
            'payment_terms'   => 'nullable|string|max:255',
            'notes'           => 'nullable|string',
        ]);

        $contact = SourcingVendorContact::create(array_merge($validated, [
            'sourcing_request_id' => $sourcing->id,
            'created_by'          => auth()->id(),
        ]));

        return response()->json([
            'message' => 'Vendor contact added successfully.',
            'data'    => $contact->load('creator:id,name'),
        ], 201);
    }

    /**
     * Update a Vendor Contact / Quote (Collaborative: ANY ZOPA Buyer).
     */
    public function updateContact(Request $request, int $id, int $contactId): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::findOrFail($id);
        $contact = SourcingVendorContact::where('sourcing_request_id', $sourcing->id)->findOrFail($contactId);

        $validated = $request->validate([
            'vendor_id'       => 'nullable|exists:vendors,id',
            'vendor_name'     => 'sometimes|required|string|max:255',
            'contact_person'  => 'nullable|string|max:150',
            'phone'           => 'nullable|string|max:50',
            'email'           => 'nullable|string|max:150',
            'quoted_price'    => 'nullable|numeric|min:0',
            'gst_rate'        => 'nullable|numeric|min:0|max:100',
            'lead_time_days'  => 'nullable|integer|min:0',
            'payment_terms'   => 'nullable|string|max:255',
            'notes'           => 'nullable|string',
        ]);

        $contact->update(array_merge($validated, [
            'updated_by' => auth()->id(),
        ]));

        return response()->json([
            'message' => 'Vendor contact updated successfully.',
            'data'    => $contact->fresh(['creator:id,name', 'updater:id,name']),
        ]);
    }

    /**
     * Delete a Vendor Contact.
     */
    public function deleteContact(int $id, int $contactId): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::findOrFail($id);
        $contact = SourcingVendorContact::where('sourcing_request_id', $sourcing->id)->findOrFail($contactId);

        $contact->delete();

        return response()->json(['message' => 'Vendor contact removed successfully.']);
    }

    /**
     * Add a Working Remark / Call Log (Collaborative: ANY ZOPA Buyer).
     */
    public function addRemark(Request $request, int $id): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::findOrFail($id);

        $validated = $request->validate([
            'remark' => 'required|string|min:1',
        ]);

        $remark = SourcingRemark::create([
            'sourcing_request_id' => $sourcing->id,
            'user_id'             => auth()->id(),
            'remark'              => $validated['remark'],
        ]);

        return response()->json([
            'message' => 'Working remark added successfully.',
            'data'    => $remark->load('user:id,name'),
        ], 201);
    }

    /**
     * Export Sourcing List to Excel / CSV.
     */
    public function export(Request $request): BinaryFileResponse
    {
        $this->requireZopaBuyerOrStaff();

        $query = SourcingRequest::with([
            'creator:id,name',
            'tenant:id,name',
            'vendorContacts',
            'remarks.user:id,name',
        ]);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        if ($request->filled('source_type') && $request->source_type !== 'all') {
            $query->where('source_type', $request->source_type);
        }
        if ($request->filled('tenant_id') && $request->tenant_id !== 'all') {
            $query->where('tenant_id', $request->tenant_id);
        }

        $records = $query->orderBy('created_at', 'desc')->get();

        $headings = [
            'Sourcing No',
            'Source',
            'PR Ref',
            'RFQ Ref',
            'Client / Org',
            'Item Name',
            'Specification',
            'Category',
            'Required Qty',
            'Unit',
            'Target Price',
            'Delivery Location',
            'Status',
            'Created By',
            'Created At',
            'Vendors Contacted',
            'Quoted Prices',
            'Latest Remark',
        ];

        $exportData = $records->map(function ($s) {
            $vendors = $s->vendorContacts->pluck('vendor_name')->implode(', ');
            $prices = $s->vendorContacts->map(function ($v) {
                return $v->vendor_name . ': ₹' . number_format((float)$v->quoted_price, 2);
            })->implode(' | ');
            $latestRemark = $s->remarks->first()?->remark ?? '';

            return [
                $s->sourcing_number,
                strtoupper($s->source_type),
                $s->pr_ref ?? '—',
                $s->rfq_ref ?? '—',
                $s->client_name ?: ($s->tenant?->name ?? '—'),
                $s->item_name,
                $s->specification ?? '',
                $s->category_name ?: ($s->category?->name ?? '—'),
                $s->qty,
                $s->unit,
                $s->target_price ? '₹' . number_format((float)$s->target_price, 2) : '—',
                $s->delivery_location ?? '—',
                ucfirst($s->status),
                $s->creator?->name ?? '—',
                $s->created_at?->format('Y-m-d H:i') ?? '',
                $vendors ?: 'None',
                $prices ?: 'None',
                $latestRemark,
            ];
        });

        $filename = 'sourcing_requests_' . date('Y_m_d_His') . '.xlsx';

        return Excel::download(new GenericExport($exportData, $headings), $filename);
    }
}
