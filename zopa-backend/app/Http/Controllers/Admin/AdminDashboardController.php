<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Grn;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    /**
     * Consolidated stats across all tenants (or scoped to one if ?tenant_id= provided).
     */
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $request->integer('tenant_id', 0);

        if ($tenantId) {
            $tenant = Tenant::find($tenantId);
            if (!$tenant) {
                return response()->json(['error' => 'Tenant not found.'], 404);
            }
            return response()->json($this->buildStats($tenantId));
        }

        // Consolidated — sum across all non-internal (client) tenants
        return response()->json($this->buildConsolidatedStats());
    }

    /**
     * List all client tenants with their summary KPIs.
     */
    public function tenants(): JsonResponse
    {
        $tenants = Tenant::where('is_internal', false)
            ->select('id', 'name', 'plan', 'is_active', 'created_at')
            ->orderBy('name')
            ->get();

        $result = $tenants->map(function ($t) {
            $stats = $this->buildStats($t->id);
            return [
                'id'          => $t->id,
                'name'        => $t->name,
                'plan'        => $t->plan,
                'is_active'   => $t->is_active,
                'created_at'  => $t->created_at,
                'kpi'         => [
                    'total_pos'    => $stats['po']['total'],
                    'total_pr'     => $stats['pr']['total'],
                    'po_value'     => $stats['po']['total_value'],
                    'pending_approvals' => $stats['po']['pending_approvals'],
                ],
            ];
        });

        return response()->json($result);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private function buildStats(int $tenantId): array
    {
        $poBase  = PurchaseOrder::where('tenant_id', $tenantId);
        $prBase  = PurchaseRequisition::where('tenant_id', $tenantId);
        $grnBase = Grn::where('tenant_id', $tenantId);
        $invBase = Invoice::where('tenant_id', $tenantId);

        return [
            'po' => [
                'total'             => (clone $poBase)->count(),
                'draft'             => (clone $poBase)->where('status', 'draft')->count(),
                'pending_approvals' => (clone $poBase)->whereIn('status', ['pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved'          => (clone $poBase)->where('status', 'approved')->count(),
                'released'          => (clone $poBase)->where('status', 'released')->count(),
                'delivered'         => (clone $poBase)->where('status', 'delivered')->count(),
                'invoiced'          => (clone $poBase)->where('status', 'invoiced')->count(),
                'payment_released'  => (clone $poBase)->where('status', 'payment_released')->count(),
                'cancelled'         => (clone $poBase)->where('status', 'cancelled')->count(),
                'total_value'       => (float) (clone $poBase)->sum('grand_total'),
                'approved_value'    => (float) (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->sum('grand_total'),
            ],
            'pr' => [
                'total'         => (clone $prBase)->count(),
                'draft'         => (clone $prBase)->where('status', 'draft')->count(),
                'submitted'     => (clone $prBase)->where('status', 'submitted')->count(),
                'rfq_created'   => (clone $prBase)->where('status', 'rfq_created')->count(),
                'rfq_approved'  => (clone $prBase)->where('status', 'rfq_approved')->count(),
                'converted'     => (clone $prBase)->where('status', 'converted')->count(),
                'rejected'      => (clone $prBase)->where('status', 'rejected')->count(),
                'total_value'   => (float) (clone $prBase)->sum('estimated_amount'),
            ],
            'grn' => [
                'total'    => (clone $grnBase)->count(),
                'pending'  => (clone $grnBase)->where('status', 'pending')->count(),
                'confirmed'=> (clone $grnBase)->where('status', 'confirmed')->count(),
            ],
            'invoice' => [
                'total'    => (clone $invBase)->count(),
                'pending'  => (clone $invBase)->whereIn('status', ['pending', 'pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved' => (clone $invBase)->where('status', 'approved')->count(),
                'rejected' => (clone $invBase)->where('status', 'rejected')->count(),
                'total_value' => (float) (clone $invBase)->sum('amount'),
            ],
        ];
    }

    private function buildConsolidatedStats(): array
    {
        // All client tenants
        $clientIds = Tenant::where('is_internal', false)->pluck('id');

        $poBase  = PurchaseOrder::whereIn('tenant_id', $clientIds);
        $prBase  = PurchaseRequisition::whereIn('tenant_id', $clientIds);
        $grnBase = Grn::whereIn('tenant_id', $clientIds);
        $invBase = Invoice::whereIn('tenant_id', $clientIds);

        return [
            'is_consolidated' => true,
            'tenant_count'    => $clientIds->count(),
            'po' => [
                'total'             => (clone $poBase)->count(),
                'draft'             => (clone $poBase)->where('status', 'draft')->count(),
                'pending_approvals' => (clone $poBase)->whereIn('status', ['pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved'          => (clone $poBase)->where('status', 'approved')->count(),
                'released'          => (clone $poBase)->where('status', 'released')->count(),
                'delivered'         => (clone $poBase)->where('status', 'delivered')->count(),
                'invoiced'          => (clone $poBase)->where('status', 'invoiced')->count(),
                'payment_released'  => (clone $poBase)->where('status', 'payment_released')->count(),
                'cancelled'         => (clone $poBase)->where('status', 'cancelled')->count(),
                'total_value'       => (float) (clone $poBase)->sum('grand_total'),
                'approved_value'    => (float) (clone $poBase)->whereNotIn('status', ['draft', 'cancelled'])->sum('grand_total'),
            ],
            'pr' => [
                'total'        => (clone $prBase)->count(),
                'draft'        => (clone $prBase)->where('status', 'draft')->count(),
                'submitted'    => (clone $prBase)->where('status', 'submitted')->count(),
                'rfq_created'  => (clone $prBase)->where('status', 'rfq_created')->count(),
                'rfq_approved' => (clone $prBase)->where('status', 'rfq_approved')->count(),
                'converted'    => (clone $prBase)->where('status', 'converted')->count(),
                'rejected'     => (clone $prBase)->where('status', 'rejected')->count(),
                'total_value'  => (float) (clone $prBase)->sum('estimated_amount'),
            ],
            'grn' => [
                'total'     => (clone $grnBase)->count(),
                'pending'   => (clone $grnBase)->where('status', 'pending')->count(),
                'confirmed' => (clone $grnBase)->where('status', 'confirmed')->count(),
            ],
            'invoice' => [
                'total'       => (clone $invBase)->count(),
                'pending'     => (clone $invBase)->whereIn('status', ['pending', 'pending_l1', 'pending_l2', 'pending_l3'])->count(),
                'approved'    => (clone $invBase)->where('status', 'approved')->count(),
                'rejected'    => (clone $invBase)->where('status', 'rejected')->count(),
                'total_value' => (float) (clone $invBase)->sum('amount'),
            ],
        ];
    }
}
