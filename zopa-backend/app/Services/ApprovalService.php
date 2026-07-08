<?php

namespace App\Services;

use App\Mail\ApprovalRequestMail;
use App\Mail\DocumentStatusMail;
use App\Models\Approval;
use App\Models\ApprovalConfig;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\User;
use App\Models\UserTenantRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class ApprovalService
{
    public function validateApprovalConfig(array $levels, int $tenantId): void
    {
        $configured = array_filter($levels, fn($l) => !empty($l['user_id']) || !empty($l['user_ids']));

        if (empty($configured)) {
            throw ValidationException::withMessages([
                'levels' => 'At least one approval level is required.',
            ]);
        }
    }

    // ─── PR Approval ──────────────────────────────────────────────────────────

    public function routePrForApproval(PurchaseRequisition $pr): void
    {
        $configs = ApprovalConfig::where('cost_center_id', $pr->cost_center_id)
            ->where('type', 'pr')
            ->where('is_active', true)
            ->orderBy('level')
            ->get();

        // No PR approval config → auto-approve (submit directly without routing)
        if ($configs->isEmpty()) {
            return;
        }

        $firstLevel = $configs->first();
        $this->createApprovalRecords('PR', $pr->id, $firstLevel);
        $pr->update(['status' => 'pending_l' . $firstLevel->level]);

        // Notify all assigned approvers at this level (parity with PO routing)
        $this->notifyLevelApprovers('PR', $pr->id, $firstLevel, $pr->load('items', 'costCenter', 'requestedBy'));
    }

    // ─── PO Approval ─────────────────────────────────────────────────────────

    public function routeForApproval(PurchaseOrder $po): void
    {
        $required = $this->requiredPoConfigs($po->cost_center_id, (float) $po->grand_total);

        // No PO approval config → auto-approve immediately (same pattern as invoices).
        if ($required->isEmpty()) {
            $po->update([
                'status'      => 'approved',
                'po_date'     => $po->po_date ?? now()->toDateString(),
                'approved_by' => auth()->id(),
                'approved_at' => now(),
            ]);
            app(TatService::class)->stamp($po->id, 'po_approved_at', now());
            return;
        }

        $firstLevel = $required->first();
        $this->createApprovalRecords('PO', $po->id, $firstLevel);
        $po->update(['status' => 'pending_l' . $firstLevel->level]);

        // Notify all assigned approvers at this level
        $this->notifyLevelApprovers('PO', $po->id, $firstLevel, $po->load('items.product', 'vendor', 'costCenter'));
    }

    // ─── Invoice Approval ─────────────────────────────────────────────────────

    public function routeInvoiceForApproval(Invoice $invoice): void
    {
        $po = PurchaseOrder::findOrFail($invoice->po_id);

        $configs = ApprovalConfig::where('cost_center_id', $po->cost_center_id)
            ->where('type', 'invoice')
            ->where('is_active', true)
            ->orderBy('level')
            ->get();

        // If no invoice approval configs: auto-approve inline
        if ($configs->isEmpty()) {
            DB::transaction(function () use ($invoice, $po) {
                $invoice->update([
                    'status'      => 'approved',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]);

                if (in_array($po->status, ['delivered', 'invoiced'])) {
                    $po->update([
                        'status'      => 'invoiced',
                        'invoiced_at' => $po->invoiced_at ?? now(),
                    ]);
                }

                app(TatService::class)->stamp($po->id, 'invoice_approved_at', now());
            });
            return;
        }

        $firstLevel = $configs->first();
        $this->createApprovalRecords('INVOICE', $invoice->id, $firstLevel);
        $invoice->update(['status' => 'pending_l' . $firstLevel->level]);
    }

    // ─── Generic Approve / Return / Reject ────────────────────────────────────

    public function approve(Approval $approval, string $comments = ''): void
    {
        DB::transaction(function () use ($approval, $comments) {
            // Mark this approval as approved
            $approval->update([
                'action'   => 'approved',
                'comments' => $comments,
                'acted_at' => now(),
            ]);

            // Supersede all other pending approvals at the same entity+level (parallel approvers)
            Approval::where('entity_type', $approval->entity_type)
                ->where('entity_id', $approval->entity_id)
                ->where('level', $approval->level)
                ->where('id', '!=', $approval->id)
                ->where('action', 'pending')
                ->update(['action' => 'superseded', 'acted_at' => now()]);

            $this->advanceOrComplete($approval);
        });
    }

    public function returnWithQuery(Approval $approval, string $comments): void
    {
        $approval->update([
            'action'   => 'returned',
            'comments' => $comments,
            'acted_at' => now(),
        ]);

        // Supersede other parallel pending approvals
        Approval::where('entity_type', $approval->entity_type)
            ->where('entity_id', $approval->entity_id)
            ->where('level', $approval->level)
            ->where('id', '!=', $approval->id)
            ->where('action', 'pending')
            ->update(['action' => 'superseded', 'acted_at' => now()]);

        if ($approval->entity_type === 'PO') {
            $po = PurchaseOrder::with(['items.product', 'vendor', 'costCenter', 'creator'])->find($approval->entity_id);
            // Set status to 'returned' (not 'draft') so the buyer sees it in a distinct tab
            $po->update(['status' => 'returned']);
            // Release the frozen budget so it's not double-consumed when buyer re-submits
            app(BudgetService::class)->release(
                $po->cost_center_id,
                app(BudgetService::class)->currentFiscalYear($po->costCenter),
                $po->grand_total,
                'PO',
                $po->id,
                auth()->id(),
                'Budget released — PO returned to buyer'
            );
            $this->notifyStatusToSource('PO', $po, 'returned', $comments);
        } elseif ($approval->entity_type === 'INVOICE') {
            $invoice = Invoice::find($approval->entity_id);
            $invoice?->update(['status' => 'pending']);
        } elseif ($approval->entity_type === 'PR') {
            $pr = PurchaseRequisition::with(['items', 'costCenter', 'requestedBy'])->find($approval->entity_id);
            $pr?->update(['status' => 'submitted']);
            if ($pr) {
                $this->notifyStatusToSource('PR', $pr, 'returned', $comments);
            }
        }
    }

    public function reject(Approval $approval, string $comments): void
    {
        $approval->update([
            'action'   => 'rejected',
            'comments' => $comments,
            'acted_at' => now(),
        ]);

        // Supersede other parallel pending approvals
        Approval::where('entity_type', $approval->entity_type)
            ->where('entity_id', $approval->entity_id)
            ->where('level', $approval->level)
            ->where('id', '!=', $approval->id)
            ->where('action', 'pending')
            ->update(['action' => 'superseded', 'acted_at' => now()]);

        if ($approval->entity_type === 'PO') {
            $po = PurchaseOrder::with(['items.product', 'vendor', 'costCenter', 'creator'])->find($approval->entity_id);
            $po->update(['status' => 'cancelled']);
            $this->notifyStatusToSource('PO', $po, 'rejected', $comments);

            app(BudgetService::class)->release(
                $po->cost_center_id,
                app(BudgetService::class)->currentFiscalYear($po->costCenter),
                $po->grand_total,
                'PO',
                $po->id,
                auth()->id(),
                'PO rejected — budget released'
            );
        } elseif ($approval->entity_type === 'INVOICE') {
            $invoice = Invoice::find($approval->entity_id);
            $invoice?->update(['status' => 'rejected']);
        } elseif ($approval->entity_type === 'PR') {
            $pr = PurchaseRequisition::with(['items', 'costCenter', 'requestedBy'])->find($approval->entity_id);
            $pr?->update(['status' => 'rejected']);
            if ($pr) {
                $this->notifyStatusToSource('PR', $pr, 'rejected', $comments);
            }
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Create one Approval record per user in the config level (parallel approval).
     */
    private function createApprovalRecords(string $entityType, int $entityId, ApprovalConfig $config): void
    {
        $userIds = $config->resolved_user_ids;
        if (empty($userIds)) return;

        foreach ($userIds as $uid) {
            Approval::create([
                'entity_type'          => $entityType,
                'entity_id'            => $entityId,
                'level'                => $config->level,
                'assigned_to_user_id'  => $uid,
                'action'               => 'pending',
            ]);
        }
    }

    /**
     * The ordered set of PO approval levels actually REQUIRED for a given amount.
     *
     * Walks active PO configs low→high and stops at the first level that can
     * finalize this amount — a level with no amount_limit (unlimited) or whose
     * amount_limit covers the PO. The LAST level returned is therefore the FINAL
     * approver. Consequences (matches the configured-levels-are-authoritative rule):
     *   • Only L1 configured          → [L1]       (L1 is final)
     *   • L1+L2 configured, amt ≤ L1  → [L1]       (L1 is final; no escalation to L2)
     *   • L1+L2+L3, amt ≤ L2          → [L1, L2]   (L2 is final)
     *   • L1+L2 configured, amt > L2  → [L1, L2]   (highest configured level is final)
     * Returns an empty collection when no levels are configured (caller auto-approves).
     * Applies uniformly regardless of who created/approves the PO (ZOPA or client).
     */
    private function requiredPoConfigs(int $costCenterId, float $amount): \Illuminate\Support\Collection
    {
        $configs = ApprovalConfig::where('cost_center_id', $costCenterId)
            ->where('type', 'po')
            ->where('is_active', true)
            ->orderBy('level')
            ->get();

        $required = collect();
        foreach ($configs as $config) {
            $required->push($config);
            if (is_null($config->amount_limit) || $amount <= (float) $config->amount_limit) {
                break;
            }
        }
        return $required;
    }

    private function advanceOrComplete(Approval $approval): void
    {
        if ($approval->entity_type === 'PO') {
            $this->advanceOrCompletePo($approval);
        } elseif ($approval->entity_type === 'INVOICE') {
            $this->advanceOrCompleteInvoice($approval);
        } elseif ($approval->entity_type === 'PR') {
            $this->advanceOrCompletePr($approval);
        }
    }

    private function advanceOrCompletePr(Approval $approval): void
    {
        $pr = PurchaseRequisition::findOrFail($approval->entity_id);

        $configs = ApprovalConfig::where('cost_center_id', $pr->cost_center_id)
            ->where('type', 'pr')
            ->where('is_active', true)
            ->where('level', '>', $approval->level)
            ->orderBy('level')
            ->get();

        $nextConfig = $configs->first();

        if ($nextConfig) {
            $this->createApprovalRecords('PR', $pr->id, $nextConfig);
            $pr->update(['status' => 'pending_l' . $nextConfig->level]);
            $this->notifyLevelApprovers('PR', $pr->id, $nextConfig, $pr->load('items', 'costCenter', 'requestedBy'));
        } else {
            // PR fully approved → back to submitted so buyer can see it
            $pr->update(['status' => 'submitted']);
            $this->notifyStatusToSource('PR', $pr->fresh(['items', 'costCenter', 'requestedBy']), 'approved');
        }
    }

    private function advanceOrCompletePo(Approval $approval): void
    {
        $po = PurchaseOrder::with('costCenter.tenant')->findOrFail($approval->entity_id);

        // requiredPoConfigs is the single source of truth for which levels this
        // PO's amount needs. The next approver is simply the next required level
        // above the one that just approved; if there is none, the highest
        // required level has signed off → the PO is fully approved.
        // This is why a PO with only L1 (or L1+L2 with no L3) finalizes at its
        // top configured level, and why a low-value PO within L1's limit is NOT
        // pushed up to L2/L3.
        $required   = $this->requiredPoConfigs($po->cost_center_id, (float) $po->grand_total);
        $nextConfig = $required->first(fn ($c) => $c->level > $approval->level);

        if ($nextConfig) {
            $this->createApprovalRecords('PO', $po->id, $nextConfig);
            $po->update(['status' => 'pending_l' . $nextConfig->level]);
            // Notify next-level approvers
            $this->notifyLevelApprovers('PO', $po->id, $nextConfig, $po->load('items.product', 'vendor', 'costCenter'));
        } else {
            $poNumber = $po->po_number ?? app(PoNumberService::class)->generate($po->costCenter->tenant);
            $po->update([
                'status'      => 'approved',
                'po_number'   => $poNumber,
                'po_date'     => now(),
                'approved_by' => auth()->id(),
                'approved_at' => now(),
            ]);

            app(TatService::class)->stamp($po->id, 'po_approved_at', now());
            $this->notifyStatusToSource('PO', $po->fresh(['items.product', 'vendor', 'costCenter', 'creator']), 'approved');
        }
    }

    private function advanceOrCompleteInvoice(Approval $approval): void
    {
        $invoice = Invoice::findOrFail($approval->entity_id);
        $po = PurchaseOrder::find($invoice->po_id);

        $configs = ApprovalConfig::where('cost_center_id', $po?->cost_center_id)
            ->where('type', 'invoice')
            ->where('is_active', true)
            ->where('level', '>', $approval->level)
            ->orderBy('level')
            ->get();

        $nextConfig = $configs->first();

        if ($nextConfig) {
            $this->createApprovalRecords('INVOICE', $invoice->id, $nextConfig);
            $invoice->update(['status' => 'pending_l' . $nextConfig->level]);
        } else {
            // Final approval
            DB::transaction(function () use ($invoice, $po) {
                $invoice->update([
                    'status'      => 'approved',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]);

                if ($po && in_array($po->status, ['delivered', 'invoiced'])) {
                    $po->update([
                        'status'      => 'invoiced',
                        'invoiced_at' => $po->invoiced_at ?? now(),
                    ]);
                }

                if ($po) {
                    app(TatService::class)->stamp($po->id, 'invoice_approved_at', now());
                }
            });
        }
    }

    /**
     * Email every pending approver at a given level that an entity awaits them.
     */
    private function notifyLevelApprovers(string $entityType, int $entityId, ApprovalConfig $config, object $entity): void
    {
        foreach ($config->resolved_user_ids as $uid) {
            $approval = Approval::where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->where('level', $config->level)
                ->where('assigned_to_user_id', $uid)
                ->where('action', 'pending')
                ->first();

            if ($approval) {
                $this->notifyApprover($approval->load('assignedTo'), $entityType, $entity);
            }
        }
    }

    /**
     * Email a single approver an action-required notice (line items + PDF +
     * one-click approve/reject links). Mail failures never break the flow.
     */
    private function notifyApprover(Approval $approval, string $entityType, object $entity): void
    {
        $user = $approval->assignedTo;
        if (!$user?->email) return;

        try {
            Mail::to($user->email)->queue(new ApprovalRequestMail($approval, $entityType, $entity));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * Notify the document's source (PO creator / PR requester) of a status change.
     */
    private function notifyStatusToSource(string $entityType, object $entity, string $event, string $comments = ''): void
    {
        $email = match ($entityType) {
            'PO' => optional($entity->creator)->email ?? optional(User::find($entity->created_by))->email,
            'PR' => optional($entity->requestedBy)->email ?? optional(User::find($entity->requested_by))->email,
            default => null,
        };

        if (!$email) return;

        try {
            Mail::to($email)->queue(new DocumentStatusMail($entityType, $entity, $event, $comments));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
