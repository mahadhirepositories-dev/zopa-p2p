<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\PurchaseRequisition;
use Illuminate\Support\Facades\DB;

try {
    DB::transaction(function () {
        $pr = PurchaseRequisition::with('items')->where('pr_number', 'PR30')->first();
        if (!$pr) {
            echo "PR30 not found.\n";
            return;
        }

        echo "PR Found: ID = {$pr->id}, Number = {$pr->pr_number}, Status = {$pr->status}, Current Estimated Amount = {$pr->estimated_amount}\n";

        // Find item 1 (sno = 1)
        $item1 = $pr->items->firstWhere('sno', 1);
        if (!$item1) {
            echo "Line Item 1 (sno = 1) not found in PR30.\n";
            return;
        }

        echo "Deleting Line Item 1: ID = {$item1->id}, Description = '{$item1->description}', Qty = {$item1->qty}, Est Price = {$item1->estimated_price}\n";
        
        // Delete item 1
        $item1->delete();

        // Re-index remaining items sno sequentially
        $remainingItems = $pr->items()->where('id', '!=', $item1->id)->orderBy('sno')->get();
        $index = 1;
        foreach ($remainingItems as $item) {
            $oldSno = $item->sno;
            if ($oldSno !== $index) {
                $item->update(['sno' => $index]);
                echo "Re-indexed Item ID = {$item->id} from sno = {$oldSno} to {$index}\n";
            } else {
                echo "Item ID = {$item->id} remains at sno = {$index}\n";
            }
            $index++;
        }

        // Recalculate PR total estimated amount
        $newEstAmount = $pr->items()->sum(DB::raw('qty * estimated_price'));
        $pr->update(['estimated_amount' => $newEstAmount]);
        echo "Updated PR Estimated Amount to: {$newEstAmount}\n";

        echo "SUCCESS: Line item 1 removed and remaining items re-indexed successfully.\n";
    });
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
