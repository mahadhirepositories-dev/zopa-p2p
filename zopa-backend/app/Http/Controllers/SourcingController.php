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

        $currentRole = app()->bound('currentRole') ? app('currentRole') : null;
        $isZopaRole = in_array($currentRole, [
            'zopa_super_admin', 'zopa_buyer', 'zopa_approver_l1', 'zopa_approver_l2', 'zopa_approver_l3', 'zopa_pr', 'zopa_grn'
        ]);

        if (!$user->is_zopa_staff && !$isZopaRole) {
            abort(403, 'The Sourcing module is only accessible to ZOPA Internal Organization.');
        }
    }

    /**
     * Fuzzy match an input name against the Product master.
     * Returns top matches with similarity percentage and details.
     */
    public function findProductMatches(string $inputName, ?int $tenantId = null, int $limit = 5): array
    {
        $cleanInput = strtolower(trim(preg_replace('/[^a-zA-Z0-9\s]/', ' ', $inputName)));
        if (strlen($cleanInput) < 2) {
            return [];
        }

        $inputTokens = array_filter(explode(' ', $cleanInput), fn($t) => strlen($t) > 1);

        $query = Product::with(['category:id,name', 'subcategory:id,name'])->where('is_active', true);
        if ($tenantId) {
            $query->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            });
        }
        $products = $query->get();

        $scored = [];
        foreach ($products as $prod) {
            $cleanProdName = strtolower(trim(preg_replace('/[^a-zA-Z0-9\s]/', ' ', $prod->name)));
            $prodTokens = array_filter(explode(' ', $cleanProdName), fn($t) => strlen($t) > 1);

            // 1. Exact or Substring match
            if ($cleanInput === $cleanProdName) {
                $similarity = 100;
            } elseif (str_contains($cleanProdName, $cleanInput) || str_contains($cleanInput, $cleanProdName)) {
                $similarity = 88;
            } else {
                // 2. Token overlap score
                $commonTokens = array_intersect($inputTokens, $prodTokens);
                $tokenScore = count($inputTokens) > 0 ? (count($commonTokens) / count($inputTokens)) * 70 : 0;

                // 3. Similar text percentage
                similar_text($cleanInput, $cleanProdName, $similarTextPercent);

                // 4. Levenshtein distance score
                $lev = levenshtein(substr($cleanInput, 0, 255), substr($cleanProdName, 0, 255));
                $maxLen = max(strlen($cleanInput), strlen($cleanProdName));
                $levScore = $maxLen > 0 ? max(0, (1 - ($lev / $maxLen)) * 100) : 0;

                $similarity = round(max($similarTextPercent, ($tokenScore + ($levScore * 0.3))));
            }

            if ($similarity >= 35) {
                $scored[] = [
                    'product_id'   => $prod->id,
                    'name'         => $prod->name,
                    'code'         => $prod->code,
                    'unit'         => $prod->unit,
                    'net_rate'     => (float) $prod->net_rate,
                    'gst_rate'     => (float) $prod->gst_rate,
                    'category'     => $prod->category?->name,
                    'category_id'  => $prod->category_id,
                    'score'        => min(100, (int) $similarity),
                ];
            }
        }

        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

        return array_slice($scored, 0, $limit);
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
        
        // Count uncatalogued items in active PRs
        $prQueueCount = PrItem::whereNull('product_id')
            ->whereHas('pr', fn($q) => $q->whereNotIn('status', ['draft', 'rejected', 'short_closed', 'converted']))
            ->whereDoesntHave('sourcingRequests', fn($q) => $q->where('status', 'open'))
            ->count();

        $stats = [
            'total'         => $all->count(),
            'open'          => $all->where('status', 'open')->count(),
            'closed'        => $all->where('status', 'closed')->count(),
            'from_pr'       => $all->where('source_type', 'pr')->count(),
            'direct'        => $all->where('source_type', 'direct')->count(),
            'pr_queue_count'=> $prQueueCount,
        ];

        return response()->json([
            'data'  => $requests,
            'stats' => $stats,
        ]);
    }

    /**
     * Uncatalogued PR Stream: Fetches all free-text PR line items across all client orgs with typo / master match suggestions.
     */
    public function prQueue(Request $request): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $query = PrItem::with([
            'pr.tenant:id,name,code',
            'pr.location:id,name',
            'pr.costCenter:id,name',
            'category:id,name',
            'sourcingRequests',
        ])
        ->whereNull('product_id')
        ->whereHas('pr', function ($q) {
            $q->whereNotIn('status', ['draft', 'rejected', 'short_closed']);
        });

        if ($request->filled('tenant_id') && $request->tenant_id !== 'all') {
            $query->whereHas('pr', fn($q) => $q->where('tenant_id', $request->tenant_id));
        }

        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('description', 'LIKE', "%{$s}%")
                  ->orWhereHas('pr', fn($pq) => $pq->where('pr_number', 'LIKE', "%{$s}%")->orWhere('pr_ref', 'LIKE', "%{$s}%"));
            });
        }

        $items = $query->orderBy('id', 'desc')->get();

        // Attach fuzzy match suggestions for each free-text item
        $enriched = $items->map(function ($item) {
            $suggestions = $this->findProductMatches($item->description, $item->pr?->tenant_id, 3);
            $bestMatch = !empty($suggestions) ? $suggestions[0] : null;

            return [
                'id'                => $item->id,
                'pr_id'             => $item->pr_id,
                'pr_number'         => $item->pr?->pr_number ?: $item->pr?->pr_ref,
                'client_name'       => $item->pr?->tenant?->name ?? 'Client',
                'tenant_id'         => $item->pr?->tenant_id,
                'delivery_location' => $item->pr?->location?->name,
                'description'       => $item->description,
                'qty'               => (float) $item->qty,
                'unit'              => $item->unit ?: 'Nos',
                'estimated_price'   => (float) $item->estimated_price,
                'category_name'     => $item->category?->name,
                'category_id'       => $item->category_id,
                'remarks'           => $item->remarks,
                'created_at'        => $item->created_at,
                'has_sourcing'      => $item->sourcingRequests->isNotEmpty(),
                'active_sourcing'   => $item->sourcingRequests->firstWhere('status', 'open'),
                'best_match'        => $bestMatch,
                'suggestions'       => $suggestions,
            ];
        });

        return response()->json($enriched);
    }

    /**
     * Map a PR Line Item to an Existing Master Product (Resolves Typo & Links Master Product).
     */
    public function mapPrItemToMaster(Request $request): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $validated = $request->validate([
            'pr_item_id' => 'required|exists:pr_items,id',
            'product_id' => 'required|exists:products,id',
        ]);

        $prItem = PrItem::with('pr')->findOrFail($validated['pr_item_id']);
        $product = Product::findOrFail($validated['product_id']);

        $prItem->product_id = $product->id;
        $prItem->category_id = $product->category_id ?: $prItem->category_id;
        $prItem->unit = $product->unit ?: $prItem->unit;
        if ($product->net_rate > 0) {
            $prItem->estimated_price = $product->net_rate;
        }
        $prItem->save();

        // If any open sourcing request exists for this PR item, resolve and close it
        SourcingRequest::where('pr_item_id', $prItem->id)
            ->where('status', 'open')
            ->update([
                'product_id'    => $product->id,
                'target_price'  => $product->net_rate,
                'status'        => 'closed',
                'closed_at'     => now(),
                'closed_by'     => auth()->id(),
                'closure_notes' => "Mapped to master product: {$product->name} (Code: {$product->code})",
            ]);

        return response()->json([
            'message' => "Item mapped to master product '{$product->name}'. Typo resolved and linked to catalog.",
            'data'    => $prItem->fresh(['product', 'category']),
        ]);
    }

    /**
     * Get fuzzy match suggestions for any product name.
     */
    public function matchSuggestions(Request $request): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $name = trim($request->input('name', ''));
        if (!$name) {
            return response()->json([]);
        }

        $tenantId = $request->input('tenant_id') ? (int) $request->input('tenant_id') : null;
        $matches = $this->findProductMatches($name, $tenantId, 5);

        return response()->json($matches);
    }

    /**
     * Map a Sourcing Request to a Master Product.
     */
    public function mapToMaster(Request $request, int $id): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::findOrFail($id);
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
        ]);

        $product = Product::findOrFail($validated['product_id']);

        $sourcing->product_id = $product->id;
        $sourcing->category_id = $product->category_id ?: $sourcing->category_id;
        $sourcing->unit = $product->unit ?: $sourcing->unit;
        if ($product->net_rate > 0) {
            $sourcing->target_price = $product->net_rate;
        }
        $sourcing->status = 'closed';
        $sourcing->closed_at = now();
        $sourcing->closed_by = auth()->id();
        $sourcing->closure_notes = "Resolved & mapped to master product: {$product->name} (Code: {$product->code})";
        $sourcing->save();

        // Also update linked PR item if present
        if ($sourcing->pr_item_id) {
            PrItem::where('id', $sourcing->pr_item_id)->update([
                'product_id'      => $product->id,
                'category_id'     => $product->category_id,
                'unit'            => $product->unit,
                'estimated_price' => $product->net_rate > 0 ? $product->net_rate : DB::raw('estimated_price'),
            ]);
        }

        return response()->json([
            'message' => "Sourcing request mapped to master product '{$product->name}'.",
            'data'    => $sourcing->fresh(['product', 'category', 'closedBy:id,name']),
        ]);
    }

    /**
     * Promote a finalized Sourced Item into the Product Master Catalog.
     */
    public function promoteToMaster(Request $request, int $id): JsonResponse
    {
        $this->requireZopaBuyerOrStaff();

        $sourcing = SourcingRequest::with('vendorContacts')->findOrFail($id);

        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'code'           => 'nullable|string|max:50',
            'description'    => 'nullable|string',
            'category_id'    => 'nullable|exists:categories,id',
            'unit'           => 'required|string|max:30',
            'net_rate'       => 'required|numeric|min:0',
            'gst_rate'       => 'nullable|numeric|min:0|max:100',
            'hsn_code'       => 'nullable|string|max:50',
        ]);

        $product = Product::create([
            'tenant_id'   => $sourcing->tenant_id,
            'name'        => $validated['name'],
            'code'        => $validated['code'] ?: ('PRD-' . strtoupper(substr(uniqid(), -5))),
            'description' => $validated['description'] ?? $sourcing->specification,
            'category_id' => $validated['category_id'] ?? $sourcing->category_id,
            'unit'        => $validated['unit'],
            'net_rate'    => $validated['net_rate'],
            'gst_rate'    => $validated['gst_rate'] ?? 18,
            'hsn_code'    => $validated['hsn_code'] ?? null,
            'is_active'   => true,
        ]);

        $sourcing->product_id = $product->id;
        $sourcing->save();

        if ($sourcing->pr_item_id) {
            PrItem::where('id', $sourcing->pr_item_id)->update([
                'product_id'      => $product->id,
                'estimated_price' => $product->net_rate,
            ]);
        }

        return response()->json([
            'message' => "Item '{$product->name}' successfully added to Product Master catalog.",
            'data'    => $product->load('category'),
        ], 201);
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

        if ($request->filled('tenant_id') && $request->tenant_id !== 'all') {
            $query->whereHas('pr', fn($q) => $q->where('tenant_id', $request->tenant_id));
        }

        if ($request->boolean('unpriced_only')) {
            $query->where(function ($q) {
                $q->whereNull('estimated_price')
                  ->orWhere('estimated_price', '<=', 0)
                  ->orWhereNull('product_id');
            });
        }

        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('description', 'LIKE', "%{$s}%")
                  ->orWhereHas('pr', function ($prQ) use ($s) {
                      $prQ->where('pr_number', 'LIKE', "%{$s}%")
                          ->orWhere('pr_ref', 'LIKE', "%{$s}%")
                          ->orWhere('title', 'LIKE', "%{$s}%")
                          ->orWhereHas('tenant', fn($tQ) => $tQ->where('name', 'LIKE', "%{$s}%"));
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
            'vendor_name'        => 'nullable|string|max:255',
            'contact_person'     => 'nullable|string|max:150',
            'phone'              => 'nullable|string|max:50',
            'email'              => 'nullable|string|max:150',
            'quoted_price'       => 'nullable|numeric|min:0',
            'payment_terms'      => 'nullable|string|max:255',
            'vendor_notes'       => 'nullable|string',
            'initial_remark'     => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $user = auth()->user();

            $categoryName = $validated['category_name'] ?? null;
            if (!empty($validated['category_id']) && empty($categoryName)) {
                $category = Category::find($validated['category_id']);
                $categoryName = $category?->name;
            }

            $clientName = $validated['client_name'] ?? null;
            if (!empty($validated['tenant_id']) && empty($clientName)) {
                $tenant = Tenant::find($validated['tenant_id']);
                $clientName = $tenant?->name;
            }

            $deliveryLocation = $validated['delivery_location'] ?? null;
            if (!empty($validated['location_id']) && empty($deliveryLocation)) {
                $loc = Location::find($validated['location_id']);
                $deliveryLocation = $loc?->name;
            }

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
     * Show detailed Sourcing Request with fuzzy master suggestions attached.
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
            'product:id,name,code,net_rate,unit',
            'pr:id,pr_number,title,status,tenant_id',
            'vendorContacts.creator:id,name',
            'vendorContacts.updater:id,name',
            'remarks.user:id,name',
        ])->findOrFail($id);

        // If no product is linked, find top master product matches to help buyer resolve typos
        $suggestions = [];
        if (!$sourcing->product_id) {
            $suggestions = $this->findProductMatches($sourcing->item_name, $sourcing->tenant_id, 4);
        }

        $res = $sourcing->toArray();
        $res['master_suggestions'] = $suggestions;

        return response()->json($res);
    }

    /**
     * Update Sourcing Request.
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
     * Delete Sourcing Request.
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
     * Add a Vendor Contact / Quote.
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
     * Update a Vendor Contact / Quote.
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
     * Add a Working Remark / Call Log.
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
