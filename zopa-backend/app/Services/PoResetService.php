<?php

namespace App\Services;

use App\Models\{PurchaseOrder, BudgetLedger, Grn, GrnItem, Invoice, Approval, EmailActionToken, TatRecord};
use Illuminate\Support\Facades\DB;

/**
 * Resets a Purchase Order back to DRAFT, reversing every lifecycle side effect
 * in one transaction so the approval flow can be re-run cleanly. Shared by the
 * `po:reset-to-draft` artisan command and the super-admin "Reset to Draft"
 * action on the PO page.
 */
class PoResetService
{
    public function __construct(private ActivityLogService $actLog) {}

    public function resetToDraft(PurchaseOrder $po): void
    {
        $approvalIds = Approval::where('entity_type', 'PO')->where('entity_id', $po->id)->pluck('id');
        $grnIds      = Grn::where('po_id', $po->id)->pluck('id');

        DB::transaction(function () use ($po, $approvalIds, $grnIds) {
            // one-click approve/reject tokens tied to this PO's approvals
            EmailActionToken::whereIn('approval_id', $approvalIds)->delete();
            Approval::where('entity_type', 'PO')->where('entity_id', $po->id)->delete();

            // goods receipts
            GrnItem::whereIn('grn_id', $grnIds)->delete();
            Grn::where('po_id', $po->id)->delete();

            // invoices
            Invoice::where('po_id', $po->id)->delete();

            // budget freeze ledger → restores available budget (event-sourced)
            BudgetLedger::where('reference_type', 'PO')->where('reference_id', $po->id)->delete();

            // TAT lifecycle stamps (keep po_created_at)
            TatRecord::where('po_id', $po->id)->update([
                'po_approved_at'      => null,
                'po_released_at'      => null,
                'po_delivered_at'     => null,
                'invoice_approved_at' => null,
            ]);

            // the PO itself
            $po->update([
                'status'              => 'draft',
                'po_number'           => null,
                'po_date'             => null,
                'approved_by'         => null,
                'approved_by_role'    => null,
                'approved_at'         => null,
                'released_at'         => null,
                'delivered_at'        => null,
                'invoiced_at'         => null,
                'payment_released_at' => null,
            ]);

            $this->actLog->log('PO', $po->id, 'updated', [
                'note' => 'Reset to draft to re-run the approval flow',
            ], $po->tenant_id);
        });
    }
}
