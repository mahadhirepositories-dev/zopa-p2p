<?php

namespace App\Console\Commands;

use App\Models\PurchaseRequisition;
use Illuminate\Console\Command;

class SyncPrConversion extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pr:sync-conversion {--pr= : Optional specific PR ID to sync}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate and auto-heal PR conversion status and item converted_qty across all PRs';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $specificPr = $this->option('pr');
        $query = PurchaseRequisition::query();

        if ($specificPr) {
            $query->where('id', $specificPr)->orWhere('pr_number', $specificPr);
        } else {
            $query->whereIn('status', ['submitted', 'rfq_created', 'rfq_approved', 'partially_converted', 'converted']);
        }

        $prs = $query->get();
        $count = 0;

        foreach ($prs as $pr) {
            PurchaseRequisition::syncPrConversion($pr);
            $count++;
        }

        $this->info("Successfully synced conversion status for {$count} PR(s).");
        return 0;
    }
}
