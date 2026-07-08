<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\CostCenter;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\Vendor;
use Illuminate\Support\Facades\DB;

class FixApolloData extends Command
{
    protected $signature = 'data:fix-apollo';
    protected $description = 'Interactive command to move PO/PR/Vendor from Total Health to Apollo Isha Vidhya Niketan and remove duplicates';

    public function handle()
    {
        $this->info("This command will help you move a wrongly added PO, its PR, and Vendor from 'Total Health' to 'Apollo Isha Vidhya Niketan' cost centers/tenants, and optionally remove duplicates.");

        $totalHealth = CostCenter::where('name', 'like', '%Total Health%')->first();
        $apollo = CostCenter::where('name', 'like', '%Apollo%')->first();

        if (!$totalHealth) {
            $this->warn("Could not find 'Total Health' cost center.");
        } else {
            $this->info("Found Total Health Cost Center: ID {$totalHealth->id}");
        }

        if (!$apollo) {
            $this->warn("Could not find 'Apollo' cost center.");
        } else {
            $this->info("Found Apollo Cost Center: ID {$apollo->id}");
        }

        $this->info("\n--- 1. Move PO and PR ---");
        $poNumber = $this->ask("Enter the PO Number that was wrongly created (leave blank to skip)");
        if ($poNumber) {
            $po = PurchaseOrder::where('po_number', $poNumber)->first();
            if ($po) {
                $this->info("Found PO ID: {$po->id}, Current Cost Center ID: {$po->cost_center_id}");
                $targetCc = $this->ask("Enter the TARGET Cost Center ID to move this PO to (e.g. {$apollo?->id})");
                if ($targetCc && $this->confirm("Move PO {$poNumber} to Cost Center {$targetCc}?")) {
                    $po->cost_center_id = $targetCc;
                    $po->save();
                    $this->info("PO moved successfully.");
                }

                if ($po->pr_id) {
                    $pr = PurchaseRequisition::find($po->pr_id);
                    if ($pr && $this->confirm("Associated PR {$pr->pr_number} found. Move PR to Cost Center {$targetCc}?")) {
                        $pr->cost_center_id = $targetCc;
                        $pr->save();
                        $this->info("PR moved successfully.");
                    }
                }
            } else {
                $this->error("PO not found.");
            }
        }

        $this->info("\n--- 2. Move Vendor ---");
        $vendorName = $this->ask("Enter the exact or partial Vendor Name that was wrongly created (leave blank to skip)");
        if ($vendorName) {
            $vendors = Vendor::where('name', 'like', "%{$vendorName}%")->get();
            if ($vendors->isEmpty()) {
                $this->error("No vendors found matching {$vendorName}");
            } else {
                foreach ($vendors as $v) {
                    $this->info("Found Vendor ID: {$v->id} | Name: {$v->name} | Tenant ID: {$v->tenant_id}");
                }
                $vendorId = $this->ask("Enter the ID of the Vendor you want to move");
                $targetTenant = $this->ask("Enter the TARGET Tenant ID to move this Vendor to");
                if ($vendorId && $targetTenant && $this->confirm("Move Vendor ID {$vendorId} to Tenant ID {$targetTenant}?")) {
                    $v = Vendor::find($vendorId);
                    if ($v) {
                        $v->tenant_id = $targetTenant;
                        $v->save();
                        $this->info("Vendor moved successfully.");
                    }
                }
            }
        }

        $this->info("\n--- 3. Delete Duplicates ---");
        if ($this->confirm("Do you want to delete any duplicate records?")) {
            $type = $this->choice("What type of record?", ['PO', 'PR', 'Vendor', 'None'], 3);
            if ($type !== 'None') {
                $idToDelete = $this->ask("Enter the ID of the {$type} to delete");
                if ($idToDelete && $this->confirm("Are you sure you want to PERMANENTLY DELETE {$type} ID {$idToDelete}?")) {
                    switch ($type) {
                        case 'PO':
                            PurchaseOrder::destroy($idToDelete);
                            break;
                        case 'PR':
                            $pr = PurchaseRequisition::find($idToDelete);
                            if ($pr) {
                                $pr->items()->delete();
                                $pr->delete();
                            }
                            break;
                        case 'Vendor':
                            Vendor::destroy($idToDelete);
                            break;
                    }
                    $this->info("Deleted successfully.");
                }
            }
        }

        $this->info("\nDone!");
    }
}
