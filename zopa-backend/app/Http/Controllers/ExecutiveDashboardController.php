<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Grn;
use App\Models\Invoice;
use App\Models\PrItem;
use App\Models\PoItem;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\TatRecord;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExecutiveDashboardController extends Controller
{
    use AuthorizesRoles;

    /**
     * Get all 18 Executive KPIs for presentation and reporting.
     * ZOPA Admin can pass ?tenant_id=X (0 = All Entities).
     * Client Users are strictly scoped to their current tenant.
     */
    public function stats(Request $request): JsonResponse
    {
        // Outside the try, whose catch would turn this 403 into a 500.
        $this->authorizeDashboard();

        try {
            $scope = $this->determineScope($request);
            $tenantId = $scope['tenant_id']; // 0 = all client tenants, >0 = specific tenant
            $isZopaAdmin = $scope['is_zopa_admin'];

            $period   = $request->input('period', 'all');
            $fromDate = $request->input('from_date');
            $toDate   = $request->input('to_date');

            $kpis = $this->calculateExecutiveKpis($tenantId, $period, $fromDate, $toDate);
            $kpis['user_scope'] = [
              'is_zopa_admin' => $isZopaAdmin,
              'tenant_id'     => $tenantId,
              'tenant_name'   => $scope['tenant_name'],
            ];
            if (!$this->can('purchase_requisitions', 'view')) {
                $kpis['pending_pr_tracking'] = [];
            }

            return response()->json($kpis);
        } catch (\Throwable $e) {
            Log::error('ExecutiveDashboardController stats error: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error'   => 'Failed to load executive dashboard statistics',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download Executive Dashboard metrics report as CSV.
     */
    public function export(Request $request): StreamedResponse
    {
        $this->authorizeDashboard();

        $scope = $this->determineScope($request);
        $tenantId = $scope['tenant_id'];
        $orgName = $scope['tenant_name'];

        $period   = $request->input('period', 'all');
        $fromDate = $request->input('from_date');
        $toDate   = $request->input('to_date');

        $kpis = $this->calculateExecutiveKpis($tenantId, $period, $fromDate, $toDate);

        $fileName = 'executive_dashboard_kpi_report_' . now()->format('Ymd_His') . '.csv';

        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            'Pragma'              => 'no-cache',
            'Cache-Control'       => 'must-revalidate, post-check=0, pre-check=0',
            'Expires'             => '0',
        ];

        $callback = function () use ($kpis, $orgName, $period, $fromDate, $toDate) {
            $file = fopen('php://output', 'w');

            fputcsv($file, ['ZOPA P2P EXECUTIVE DASHBOARD KPI REPORT']);
            fputcsv($file, ['Scope:', $orgName]);
            fputcsv($file, ['Period:', strtoupper($period)]);
            if ($fromDate && $toDate) {
                fputcsv($file, ['Date Range:', "{$fromDate} to {$toDate}"]);
            }
            fputcsv($file, ['Exported At:', now()->format('Y-m-d H:i:s')]);
            fputcsv($file, []);

            // 18 Key Presentation KPIs
            fputcsv($file, ['EXECUTIVE SUMMARY KPIs']);
            fputcsv($file, ['KPI Name', 'Value / Metric', 'Unit / Details']);
            fputcsv($file, ['1. Orders Processed', $kpis['orders_processed'], 'Purchase Orders']);
            fputcsv($file, ['2. Total Value Managed', '₹' . number_format($kpis['total_value_managed'], 2), 'INR']);
            fputcsv($file, ['3. Vendors Managed', $kpis['vendors_managed'], 'Active Vendors']);
            fputcsv($file, ['4. Categories Handled', $kpis['categories_handled'], 'Product Categories']);
            fputcsv($file, ['5. Projects Served', $kpis['projects_served'], 'Projects']);
            fputcsv($file, ['6. Project Locations Managed', $kpis['project_locations_managed'], 'Locations']);
            $orNoData = fn($value, string $text) => $value === null ? 'No data' : $text;
            fputcsv($file, ['7. Total Savings Realized', $orNoData($kpis['total_savings_realized'], '₹' . number_format($kpis['total_savings_realized'] ?? 0, 2)), 'INR (PR Est. vs PO Actual, before GST)']);
            fputcsv($file, ['8. Average Savings Percentage', $orNoData($kpis['avg_savings_percentage'], $kpis['avg_savings_percentage'] . '%'), 'Percentage']);
            fputcsv($file, ['9. Average PR TAT', $orNoData($kpis['avg_pr_tat_days'], $kpis['avg_pr_tat_days'] . ' days'), 'Submission to PO Creation, net of clarification']);
            fputcsv($file, ['10. Average PO Issue TAT', $orNoData($kpis['avg_po_issue_tat_days'], $kpis['avg_po_issue_tat_days'] . ' days'), 'Creation to Release']);
            fputcsv($file, ['11. Medicine & Lab Stock Outage Rate', $kpis['medicine_lab_outage_rate'] . '%', 'Urgent Requisitions Rate']);
            fputcsv($file, ['12. Local Procurement Volume', $orNoData($kpis['local_procurement_spend'], '₹' . number_format($kpis['local_procurement_spend'] ?? 0, 2)), $orNoData($kpis['local_procurement_pct'], $kpis['local_procurement_pct'] . '% of Total Spend (same-state vendors)')]);
            fputcsv($file, []);

            // PR TAT Distribution
            fputcsv($file, ['PR TAT DISTRIBUTION']);
            fputcsv($file, ['Range', 'PR Count', 'Share %']);
            foreach ($kpis['pr_tat_distribution'] as $range => $dist) {
                fputcsv($file, [$range, $dist['count'], $dist['pct'] . '%']);
            }
            fputcsv($file, []);

            // Max TAT Delay Case
            fputcsv($file, ['MAXIMUM TAT DELAY CASE']);
            if ($kpis['max_tat_case']) {
                $mc = $kpis['max_tat_case'];
                fputcsv($file, ['PO/PR Number', $mc['number']]);
                fputcsv($file, ['Document Type', $mc['type']]);
                fputcsv($file, ['Total TAT Days', $mc['tat_days'] . ' days']);
                fputcsv($file, ['Status', $mc['status']]);
                fputcsv($file, ['Slowest Stage', $mc['slowest_stage']]);
            } else {
                fputcsv($file, ['No delayed cases found.']);
            }
            fputcsv($file, []);

            // Category Spend & Savings Breakdown
            fputcsv($file, ['VALUE SHARE & NEGOTIATED SAVINGS BY CATEGORY']);
            fputcsv($file, ['Category Name', 'Spend incl. GST (INR)', 'Share %', 'PR Estimate before GST (INR)', 'Savings before GST (INR)', 'Savings %']);
            foreach ($kpis['category_spend'] as $cat) {
                fputcsv($file, [
                    $cat['category_name'],
                    $cat['spend'],
                    $cat['share_pct'] . '%',
                    $cat['estimated_budget'] ?? 'N/A',
                    $cat['savings'] ?? 'N/A',
                    $cat['savings_pct'] === null ? 'N/A' : $cat['savings_pct'] . '%',
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /** executive_dashboard view is on for every role by default, and this page is built on PO values, so it takes PO view too. */
    private function authorizeDashboard(): void
    {
        $this->requirePermission('executive_dashboard', 'view');
        $this->requirePermission('purchase_orders', 'view');
    }

    private function determineScope(Request $request): array
    {
        $role = app()->bound('currentRole') ? app('currentRole') : null;
        $user = auth()->user();
        $isZopaAdmin = ($role === 'zopa_super_admin' || $user?->is_zopa_admin);

        if ($isZopaAdmin) {
            $requestedTenantId = $request->integer('tenant_id', 0);
            if ($requestedTenantId > 0) {
                $tenant = Tenant::find($requestedTenantId);
                return [
                    'is_zopa_admin' => true,
                    'tenant_id'     => $requestedTenantId,
                    'tenant_name'   => $tenant ? $tenant->name : "Org #{$requestedTenantId}",
                ];
            }
            return [
                'is_zopa_admin' => true,
                'tenant_id'     => 0, // All client tenants
                'tenant_name'   => 'All Organizations',
            ];
        }

        // Client login user: strictly scoped to current tenant
        $tenant = app()->bound('currentTenant') ? app('currentTenant') : null;
        $tenantId = $tenant?->id ?? $user?->tenant_id;
        abort_if(!$tenantId, 403, 'Unauthorized organization access.');
        $tenantName = $tenant?->name ?? 'Organization';

        return [
            'is_zopa_admin' => false,
            'tenant_id'     => (int) $tenantId,
            'tenant_name'   => $tenantName,
        ];
    }


    /** Names the longer of the two recorded stages between PO creation and vendor release. */
    private function slowestStage(PurchaseOrder $po): string
    {
        if (!$po->approved_at) {
            return 'Stage timing not recorded';
        }

        $approval = round($po->created_at->diffInHours($po->approved_at) / 24, 1);
        $release  = round($po->approved_at->diffInHours($po->released_at) / 24, 1);

        return $approval >= $release
            ? "Creation to approval ({$approval} days)"
            : "Approval to vendor release ({$release} days)";
    }

    /** POs waiting at one stage, how long the oldest has waited, and the impact that implies. */
    private function delayStage(string $stage, array $statuses, string $waitingSince, $tenantIds): array
    {
        $query  = PurchaseOrder::whereIn('tenant_id', $tenantIds)->whereIn('status', $statuses);
        $oldest = (clone $query)->min($waitingSince);
        $days   = $oldest ? round(Carbon::parse($oldest)->diffInHours(now()) / 24, 1) : null;

        return [
            'stage'       => $stage,
            'count'       => $query->count(),
            'oldest_days' => $days,
            'impact'      => match (true) {
                $days === null => 'None',
                $days > 7      => 'High',
                $days > 3      => 'Moderate',
                default        => 'Low',
            },
        ];
    }

    private function applyDateFilter($query, string $period, ?string $fromDate, ?string $toDate, string $column = 'created_at')
    {
        return match ($period) {
            'today'      => $query->whereDate($column, now()->toDateString()),
            'this_week'  => $query->whereBetween($column, [now()->startOfWeek(), now()->endOfWeek()]),
            'this_month' => $query->whereBetween($column, [now()->startOfMonth(), now()->endOfMonth()]),
            'last_month' => $query->whereBetween($column, [now()->subMonthNoOverflow()->startOfMonth(), now()->subMonthNoOverflow()->endOfMonth()]),
            'this_year'  => $query->whereBetween($column, [now()->startOfYear(), now()->endOfYear()]),
            'custom'     => ($fromDate && $toDate)
                            ? $query->whereBetween($column, [$fromDate . ' 00:00:00', $toDate . ' 23:59:59'])
                            : $query,
            default      => $query,
        };
    }

    private function calculateExecutiveKpis(int $tenantId, string $period, ?string $fromDate, ?string $toDate): array
    {
        // ── Base Queries ──────────────────────────────────────────────────────
        $clientTenantIds = ($tenantId === 0)
            ? Tenant::where('is_internal', false)->pluck('id')
            : collect([$tenantId]);

        $poBase = PurchaseOrder::whereIn('tenant_id', $clientTenantIds);
        $prBase = PurchaseRequisition::whereIn('tenant_id', $clientTenantIds);
        $vendorBase = Vendor::whereIn('tenant_id', $clientTenantIds);

        $this->applyDateFilter($poBase, $period, $fromDate, $toDate, 'created_at');
        $this->applyDateFilter($prBase, $period, $fromDate, $toDate, 'created_at');

        // 1. Orders Processed
        $ordersProcessed = (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->count();

        // 2. Total Value Managed
        $totalValueManaged = (float) (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->sum('grand_total');

        // 3. Vendors Managed
        $activeVendorIds = (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->whereNotNull('vendor_id')->distinct()->pluck('vendor_id');
        $vendorsManaged = $activeVendorIds->count();
        if ($vendorsManaged === 0) {
            $vendorsManaged = (clone $vendorBase)->where('is_active', true)->count();
        }

        // 4. Categories Handled
        $poIds = (clone $poBase)->pluck('id');
        $categoryIdsFromPo = PoItem::whereIn('po_id', $poIds)
            ->join('products', 'po_items.product_id', '=', 'products.id')
            ->whereNotNull('products.category_id')
            ->distinct()
            ->pluck('products.category_id');

        $categoriesHandled = $categoryIdsFromPo->count();
        if ($categoriesHandled === 0) {
            $categoriesHandled = Category::whereIn('tenant_id', $clientTenantIds)->count();
        }

        // 5. Projects Served
        $projectsServed = (clone $prBase)->whereNotNull('project_id')->distinct()->pluck('project_id')->count();

        // 6. Project Locations Managed
        $locationsManaged = (clone $prBase)->whereNotNull('location_id')->distinct()->pluck('location_id')->count();

        // 7 to 10. Value share and savings by category, on issued POs.
        // A saving needs a PO line traced to a PR line with an estimated price; both rates are before GST.
        $issuedPoIds = (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->pluck('id');
        $poItems = PoItem::whereIn('po_id', $issuedPoIds)
            ->with(['product.category', 'prItem:id,estimated_price'])
            ->get();

        $categorySpendGroup = [];
        foreach ($poItems as $item) {
            $catName = $item->product?->category?->name ?? 'General Procurement';
            $group = $categorySpendGroup[$catName] ?? ['spend' => 0.0, 'estimate' => 0.0, 'actual' => 0.0];

            $group['spend'] += (float) $item->amount;
            $estimatedPrice = (float) ($item->prItem?->estimated_price ?? 0);
            if ($estimatedPrice > 0) {
                $group['estimate'] += $estimatedPrice * (float) $item->qty;
                $group['actual']   += (float) $item->net_rate * (float) $item->qty;
            }

            $categorySpendGroup[$catName] = $group;
        }

        $categorySpendList = [];
        foreach ($categorySpendGroup as $name => $group) {
            $hasEstimate = $group['estimate'] > 0;
            $savings = $group['estimate'] - $group['actual'];

            $categorySpendList[] = [
                'category_name'    => $name,
                'spend'            => round($group['spend'], 2),
                'share_pct'        => ($totalValueManaged > 0) ? round(($group['spend'] / $totalValueManaged) * 100, 1) : 0,
                'estimated_budget' => $hasEstimate ? round($group['estimate'], 2) : null,
                'savings'          => $hasEstimate ? round($savings, 2) : null,
                'savings_pct'      => $hasEstimate ? round(($savings / $group['estimate']) * 100, 1) : null,
            ];
        }
        usort($categorySpendList, fn($a, $b) => $b['spend'] <=> $a['spend']);

        $totalEstimate = array_sum(array_column($categorySpendGroup, 'estimate'));
        $totalActual   = array_sum(array_column($categorySpendGroup, 'actual'));
        $totalSavingsRealized = ($totalEstimate > 0) ? round(max(0, $totalEstimate - $totalActual), 2) : null;
        $avgSavingsPercentage = ($totalEstimate > 0) ? round(($totalSavingsRealized / $totalEstimate) * 100, 1) : null;

        // 11. Average PR Net TAT (Excluding Clarification Pause Duration), for PRs created in the period
        $prTats = TatRecord::whereHas('pr', fn($q) => $this->applyDateFilter($q->whereIn('tenant_id', $clientTenantIds), $period, $fromDate, $toDate))
            ->with('pr:id,total_clarification_duration_seconds')
            ->get();
        $avgPrTat = $prTats->filter(fn($t) => $t->pr_submitted_at && $t->po_created_at)
            ->avg(fn($t) => $t->netPrTatDays());
        $avgPrTatDays = $avgPrTat === null ? null : round($avgPrTat, 1);

        // 11b. Dedicated KPI: PR Clarification TAT (Average time taken to resolve clarification requests)
        $avgClarificationTatHours = round($prTats->filter(fn($t) => $t->clarification_requested_at && $t->clarification_provided_at)
            ->avg(fn($t) => $t->clarification_requested_at->diffInHours($t->clarification_provided_at)) ?? 0, 1);

        // 12. Average PO Issue TAT, for POs created in the period
        $poTats = TatRecord::whereHas('po', fn($q) => $this->applyDateFilter($q->whereIn('tenant_id', $clientTenantIds), $period, $fromDate, $toDate))->get();
        $avgPoIssueTat = $poTats->filter(fn($t) => $t->po_created_at && $t->po_released_at)
            ->avg(fn($t) => $t->po_created_at->diffInHours($t->po_released_at) / 24);
        $avgPoIssueTatDays = $avgPoIssueTat === null ? null : round($avgPoIssueTat, 1);

        // 13. PR TAT Distribution
        $allPrs = (clone $prBase)->get();
        $totalPrCount = max(1, $allPrs->count());
        $d1 = 0; $d3 = 0; $d7 = 0; $dMore = 0;

        foreach ($allPrs as $pr) {
            $created = $pr->created_at;
            $converted = $pr->converted_at ?? $pr->updated_at;
            $days = $created ? $created->diffInDays($converted) : 0;
            if ($days < 1) $d1++;
            elseif ($days <= 3) $d3++;
            elseif ($days <= 7) $d7++;
            else $dMore++;
        }

        $prTatDistribution = [
            '< 1 Day'    => ['count' => $d1,    'pct' => round(($d1 / $totalPrCount) * 100, 1)],
            '1 - 3 Days' => ['count' => $d3,    'pct' => round(($d3 / $totalPrCount) * 100, 1)],
            '3 - 7 Days' => ['count' => $d7,    'pct' => round(($d7 / $totalPrCount) * 100, 1)],
            '> 7 Days'   => ['count' => $dMore, 'pct' => round(($dMore / $totalPrCount) * 100, 1)],
        ];

        // 14. Max TAT Case
        $maxPo = (clone $poBase)->whereNotNull('released_at')
            ->get()
            ->sortByDesc(fn($po) => $po->created_at->diffInHours($po->released_at))
            ->first();

        $maxDays = ($maxPo && $maxPo->created_at && $maxPo->released_at)
            ? round($maxPo->created_at->diffInHours($maxPo->released_at) / 24, 1)
            : 0;

        $maxTatCase = null;
        if ($maxDays > 0) {
            $maxTatCase = [
                'id'            => $maxPo->id,
                'number'        => $maxPo->po_number,
                'type'          => 'Purchase Order',
                'tat_days'      => $maxDays,
                'status'        => ucfirst($maxPo->status),
                'slowest_stage' => $this->slowestStage($maxPo),
            ];
        }

        // 15. POs waiting at each stage, and how long the oldest has waited
        $delayMapping = [
            $this->delayStage('Multi-level Approval', ['pending_l1', 'pending_l2', 'pending_l3'], 'created_at', $clientTenantIds),
            $this->delayStage('Vendor Order Release', ['approved'], 'approved_at', $clientTenantIds),
            $this->delayStage('GRN Delivery & Receipt', ['released'], 'released_at', $clientTenantIds),
        ];

        // 16. Vendor Onboarding & Vetting
        $totalVendors = Vendor::whereIn('tenant_id', $clientTenantIds)->count();
        $approvedVendors = Vendor::whereIn('tenant_id', $clientTenantIds)->where('is_active', true)->count();

        $vendorOnboarding = [
            'total'          => $totalVendors,
            'vetted_active'  => $approvedVendors,
            'vetting_rate'   => ($totalVendors > 0) ? round(($approvedVendors / $totalVendors) * 100, 1) : 100,
        ];

        // 17. Medicine & Lab Stock Outage Rate
        $urgentPrs = (clone $prBase)->where(function($q) {
            $q->where('title', 'like', '%urgent%')
              ->orWhere('title', 'like', '%stockout%')
              ->orWhere('title', 'like', '%critical%')
              ->orWhere('title', 'like', '%emergency%');
        })->count();

        $totalPrCount = (clone $prBase)->count();
        $outageRate = ($totalPrCount > 0) ? round(($urgentPrs / $totalPrCount) * 100, 1) : 0.0;

        // 18. Local Procurement: vendor address and bill-to location in the same state, the test GST uses for CGST + SGST.
        // Stays empty when no PO records both states, because locality can't be told.
        $posWithStates = (clone $poBase)
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->with(['vendorAddress:id,state_code', 'billToLocation:id,state_code'])
            ->get()
            ->filter(fn($po) => $po->vendorAddress?->state_code && $po->billToLocation?->state_code);
        $localSpendValue = $posWithStates->isEmpty() ? null : round((float) $posWithStates
            ->filter(fn($po) => strcasecmp($po->vendorAddress->state_code, $po->billToLocation->state_code) === 0)
            ->sum('grand_total'), 2);
        $localPct = ($localSpendValue !== null && $totalValueManaged > 0)
            ? round(($localSpendValue / $totalValueManaged) * 100, 1)
            : null;

        // 19. Dedicated Tracking Data for Super Admin Oversight
        // Pending PRs: Created to Submitted / Pending Conversion
        $pendingPrs = PurchaseRequisition::whereIn('tenant_id', $clientTenantIds)
            ->whereNotIn('status', ['converted', 'rejected', 'short_closed'])
            ->with(['requestedBy:id,name', 'buyer:id,name', 'costCenter:id,name'])
            ->latest()
            ->limit(30)
            ->get()
            ->map(function ($pr) {
                return [
                    'id'             => $pr->id,
                    'pr_number'      => $pr->pr_number ?? 'Draft',
                    'title'          => $pr->title,
                    'status'         => $pr->status,
                    'pr_raiser_name' => $pr->requestedBy?->name ?? '—',
                    'buyer_name'     => $pr->buyer?->name ?? '—',
                    'cost_center'    => $pr->costCenter?->name ?? '—',
                    'created_at'     => $pr->created_at,
                    'tat_days'       => round($pr->created_at->diffInHours(now()) / 24, 1),
                ];
            });

        // Released POs Awaiting Delivery: Release -> Delivery
        $pendingDeliveryPos = PurchaseOrder::whereIn('tenant_id', $clientTenantIds)
            ->whereIn('status', ['released', 'partially_delivered'])
            ->with(['creator:id,name', 'vendor:id,name', 'costCenter:id,name'])
            ->latest()
            ->limit(30)
            ->get()
            ->map(function ($po) {
                $relAt = $po->released_at ?? $po->created_at;
                $days = round($relAt->diffInHours(now()) / 24, 1);
                return [
                    'id'                     => $po->id,
                    'po_number'              => $po->po_number ?? 'Draft',
                    'status'                 => $po->status,
                    'buyer_name'             => $po->creator?->name ?? '—',
                    'vendor_name'            => $po->vendor?->name ?? '—',
                    'cost_center'            => $po->costCenter?->name ?? '—',
                    'released_at'            => $relAt,
                    'tat_days_since_release' => $days,
                    'tat_badge'              => $days > 7 ? 'Delayed' : ($days > 3 ? 'Moderate' : 'On Track'),
                    'badge_color'            => $days > 7 ? 'red' : ($days > 3 ? 'orange' : 'green'),
                ];
            });

        return [
            'period'                        => $period,
            'from_date'                     => $fromDate,
            'to_date'                       => $toDate,
            'orders_processed'             => $ordersProcessed,
            'total_value_managed'           => round($totalValueManaged, 2),
            'vendors_managed'               => $vendorsManaged,
            'categories_handled'            => $categoriesHandled,
            'projects_served'               => $projectsServed,
            'project_locations_managed'     => $locationsManaged,
            'total_savings_realized'        => $totalSavingsRealized,
            'avg_savings_percentage'        => $avgSavingsPercentage,
            'category_spend'                => $categorySpendList,
            'avg_pr_tat_days'               => $avgPrTatDays,
            'avg_clarification_tat_hours'   => $avgClarificationTatHours,
            'avg_po_issue_tat_days'         => $avgPoIssueTatDays,

            'pr_tat_distribution'           => $prTatDistribution,
            'max_tat_case'                  => $maxTatCase,
            'delay_mapping'                 => $delayMapping,
            'vendor_onboarding'             => $vendorOnboarding,
            'medicine_lab_outage_rate'      => $outageRate,
            'local_procurement_spend'       => $localSpendValue,
            'local_procurement_pct'         => $localPct,
            'pending_pr_tracking'          => $pendingPrs,
            'po_delivery_tracking'         => $pendingDeliveryPos,
        ];
    }
}
