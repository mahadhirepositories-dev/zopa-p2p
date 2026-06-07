<?php

namespace App\Console\Commands;

use App\Models\{PurchaseOrder, BudgetLedger, Grn, GrnItem, Invoice, Approval, EmailActionToken, TatRecord};
use App\Services\{BudgetService, ActivityLogService};
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Reset a Purchase Order back to DRAFT, reversing every side effect it created
 * along its lifecycle so the approval flow can be re-run cleanly:
 *   - budget freeze ledger entries (restores available budget)
 *   - GRNs + GRN items (goods receipts)
 *   - invoices
 *   - approvals + their one-click email tokens
 *   - TAT lifecycle timestamps (approved/released/delivered/invoice-approved)
 *   - PO number + all lifecycle dates
 * The dashboard is derived from PO status counts, so it self-corrects once the
 * status flips back to draft. Dry-run by default; pass --force to apply.
 */
class ResetPoToDraft extends Command
{
    protected $signature = 'po:reset-to-draft {id : Purchase Order ID}
                            {--force : Actually perform the reset (omit for a dry run)}';

    protected $description = 'Reset a PO to draft, reversing budget/GRN/invoice/approval/TAT side effects so it can be re-submitted.';

    public function handle(BudgetService $budget): int
    {
        $id = (int) $this->argument('id');
        $po = PurchaseOrder::with('costCenter.tenant')->find($id);

        if (!$po) {
            $this->error("PO #{$id} not found.");
            return self::FAILURE;
        }

        $approvalIds  = Approval::where('entity_type', 'PO')->where('entity_id', $po->id)->pluck('id');
        $tokenCount   = EmailActionToken::whereIn('approval_id', $approvalIds)->count();
        $grnIds       = Grn::where('po_id', $po->id)->pluck('id');
        $grnItemCount = GrnItem::whereIn('grn_id', $grnIds)->count();
        $invoiceCount = Invoice::where('po_id', $po->id)->count();
        $ledger       = BudgetLedger::where('reference_type', 'PO')->where('reference_id', $po->id)->get();

        $fy = $po->costCenter && $po->costCenter->tenant
            ? $budget->currentFiscalYear($po->costCenter) : null;
        $before = ($po->cost_center_id && $fy !== null)
            ? $budget->getAvailable($po->cost_center_id, $fy)['available'] : null;

        $this->newLine();
        $this->info("PO #{$po->id}  " . ($po->po_number ?: '(no number)'));
        $this->table(['Field', 'Value'], [
            ['Status',                    $po->status],
            ['Grand Total',              '₹' . number_format((float) $po->grand_total, 2)],
            ['Cost Center',               optional($po->costCenter)->name . " (#{$po->cost_center_id})"],
            ['Budget available (before)', $before !== null ? '₹' . number_format($before, 2) : 'n/a'],
        ]);

        $this->line('Will reverse:');
        $this->line("  • Budget ledger entries : {$ledger->count()} (frozen ₹" . number_format((float) $ledger->where('action', 'freeze')->sum('freeze_amount'), 2) . ')');
        $this->line("  • GRNs / GRN items      : {$grnIds->count()} / {$grnItemCount}");
        $this->line("  • Invoices              : {$invoiceCount}");
        $this->line("  • Approvals / tokens    : {$approvalIds->count()} / {$tokenCount}");
        $this->line('  • TAT lifecycle stamps  : approved/released/delivered/invoice-approved → null');
        $this->line('  • PO fields             : status→draft, po_number→null, all dates→null');

        if (!$this->option('force')) {
            $this->warn(PHP_EOL . 'DRY RUN — nothing changed. Re-run with --force to apply.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($po, $approvalIds, $grnIds) {
            EmailActionToken::whereIn('approval_id', $approvalIds)->delete();
            Approval::where('entity_type', 'PO')->where('entity_id', $po->id)->delete();
            GrnItem::whereIn('grn_id', $grnIds)->delete();
            Grn::where('po_id', $po->id)->delete();
            Invoice::where('po_id', $po->id)->delete();
            BudgetLedger::where('reference_type', 'PO')->where('reference_id', $po->id)->delete();
            TatRecord::where('po_id', $po->id)->update([
                'po_approved_at'      => null,
                'po_released_at'      => null,
                'po_delivered_at'     => null,
                'invoice_approved_at' => null,
            ]);
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
            app(ActivityLogService::class)->log('PO', $po->id, 'updated', [
                'note' => 'Reset to draft to re-run the approval flow',
            ], $po->tenant_id);
        });

        $after = ($po->cost_center_id && $fy !== null)
            ? $budget->getAvailable($po->cost_center_id, $fy)['available'] : null;

        $this->newLine();
        $this->info("✓ PO #{$po->id} reset to DRAFT.");
        if ($before !== null && $after !== null) {
            $this->line('  Budget available: ₹' . number_format($before, 2) . ' → ₹' . number_format($after, 2));
        }
        $this->line('  Configure the cost-center approval workflow, then re-open the PO and Submit for Approval.');

        return self::SUCCESS;
    }
}
