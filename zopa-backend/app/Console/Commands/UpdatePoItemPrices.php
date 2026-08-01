<?php

namespace App\Console\Commands;

use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Services\ActivityLogService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class UpdatePoItemPrices extends Command
{
    protected $signature = 'po:update-prices
                            {po_id : The database ID of the PO}
                            {--dry-run : Show what would change without applying}';

    protected $description = 'Update unit prices on a PO\'s line items and recalculate totals';

    /**
     * Price map: keyed by description fragment (case-insensitive partial match).
     * Format: [ 'description_fragment' => new_unit_price ]
     */
    private array $priceMap = [
        // PO-85 / Total Health update — 01 Aug 2026
        'ABX MINDIL 20'   => 4850,
        'ABX MINCLEAN 1'  => 1450,
    ];

    public function handle()
    {
        $poId   = (int) $this->argument('po_id');
        $dryRun = $this->option('dry-run');

        $po = PurchaseOrder::with('items')->find($poId);

        if (!$po) {
            $this->error("PO with id={$poId} not found.");
            return 1;
        }

        $this->info("PO: {$po->po_number}  |  Status: {$po->status}  |  Tenant: {$po->tenant_id}");
        $this->newLine();

        $changes = [];

        foreach ($po->items as $item) {
            foreach ($this->priceMap as $fragment => $newPrice) {
                if (stripos($item->description, $fragment) !== false) {
                    $oldPrice  = (float) $item->unit_price;
                    $oldAmount = round($oldPrice * $item->qty, 2);
                    $newAmount = round($newPrice * $item->qty, 2);

                    $changes[] = [
                        'item'       => $item,
                        'old_price'  => $oldPrice,
                        'new_price'  => $newPrice,
                        'old_amount' => $oldAmount,
                        'new_amount' => $newAmount,
                    ];

                    $this->line(sprintf(
                        "  [%s]  %-30s  %10s → %10s  (qty: %s)",
                        $item->id,
                        substr($item->description, 0, 30),
                        '₹' . number_format($oldPrice, 2),
                        '₹' . number_format($newPrice, 2),
                        $item->qty
                    ));
                    break;
                }
            }
        }

        if (empty($changes)) {
            $this->warn('No matching items found. Check the description fragments in the priceMap.');
            return 0;
        }

        if ($dryRun) {
            $this->newLine();
            $this->warn('DRY RUN — no changes applied.');
            return 0;
        }

        if (!$this->confirm("\nApply these price changes to PO #{$po->po_number}?", true)) {
            $this->line('Aborted.');
            return 0;
        }

        DB::transaction(function () use ($po, $changes) {
            foreach ($changes as $change) {
                /** @var PoItem $item */
                $item = $change['item'];
                $newPrice = $change['new_price'];

                // Recalculate tax amounts proportionally
                $taxRate      = $item->qty > 0 ? (float) $item->tax_amount / ((float) $item->unit_price * (float) $item->qty) : 0;
                $newBaseAmount = round($newPrice * $item->qty, 2);
                $newTaxAmount  = round($newBaseAmount * $taxRate, 2);
                $newTotalAmount = round($newBaseAmount + $newTaxAmount, 2);

                $item->update([
                    'unit_price'   => $newPrice,
                    'amount'       => $newBaseAmount,
                    'tax_amount'   => $newTaxAmount,
                    'total_amount' => $newTotalAmount,
                ]);
            }

            // Recalculate PO totals
            $po->load('items');
            $subtotal    = $po->items->sum(fn($i) => (float) $i->amount);
            $taxTotal    = $po->items->sum(fn($i) => (float) $i->tax_amount);
            $grandTotal  = round($subtotal + $taxTotal, 2);

            $po->update([
                'subtotal'    => round($subtotal, 2),
                'tax_amount'  => round($taxTotal, 2),
                'grand_total' => $grandTotal,
            ]);

            // Activity log
            app(ActivityLogService::class)->log('PO', $po->id, 'prices_amended', [
                'amended_by' => 'system-command',
                'changes'    => collect($changes)->map(fn($c) => [
                    'item_id'    => $c['item']->id,
                    'desc'       => $c['item']->description,
                    'old_price'  => $c['old_price'],
                    'new_price'  => $c['new_price'],
                ])->toArray(),
                'new_grand_total' => $grandTotal,
            ]);
        });

        $po->refresh();
        $this->newLine();
        $this->info('✓ Prices updated successfully.');
        $this->info("  New Grand Total: ₹" . number_format($po->grand_total, 2));

        return 0;
    }
}
