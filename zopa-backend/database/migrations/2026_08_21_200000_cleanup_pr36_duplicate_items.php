<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\PurchaseRequisition;
use App\Models\PrItem;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Clean up PR-36 in Total Health to have exactly the clean 101 items from CSV (removing duplicate repeats).
     */
    public function up(): void
    {
        $cleanItems = [
            ['sno' => 1, 'description' => 'Albendazole Oral Susp (10ml)', 'qty' => 50.0, 'unit' => 'Bottle'],
            ['sno' => 2, 'description' => 'Albendazole-400 Tablet', 'qty' => 200.0, 'unit' => 'Nos'],
            ['sno' => 3, 'description' => 'Ambroxol HCl 15mg+ Salbulamol 1mg + Guaiphenesin 50mg+ Methol 1mg per 5 ml syrup', 'qty' => 300.0, 'unit' => 'Bottle'],
            ['sno' => 4, 'description' => 'Amoxycillin 500 mg Capsule', 'qty' => 1600.0, 'unit' => 'Nos'],
            ['sno' => 5, 'description' => 'Ascorbic Acid Tablets IP (Chewable) 500 mg', 'qty' => 1500.0, 'unit' => 'Nos'],
            ['sno' => 6, 'description' => 'Azithromycin-500 Mg Tablet', 'qty' => 500.0, 'unit' => 'Nos'],
            ['sno' => 7, 'description' => 'Budesonide 0.5 mg Respule', 'qty' => 200.0, 'unit' => 'Nos'],
            ['sno' => 8, 'description' => 'Calcium 500 mg with Vit D3 Tablet', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 9, 'description' => 'Cepodoxime 200mg + Oflaxacin 200mg tablet', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 10, 'description' => 'Ciprofloxacin 500 Mg Tablet', 'qty' => 1600.0, 'unit' => 'Nos'],
            ['sno' => 11, 'description' => 'Diclofenac sodium 1 % w/w, Methylsalicylate 10% w/w, Menthol 5 % gel (30Mg gel) 30 Grms', 'qty' => 200.0, 'unit' => 'Nos'],
            ['sno' => 12, 'description' => 'Digestive Enzyme 100ml Syrup', 'qty' => 300.0, 'unit' => 'Bottle'],
            ['sno' => 13, 'description' => 'FramycetinSulphate cream 10 Grms', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 14, 'description' => 'Glimipride 1mg + Metformin 500mg Tablet', 'qty' => 1600.0, 'unit' => 'Nos'],
            ['sno' => 15, 'description' => 'Lactulose Syrup 100 ml', 'qty' => 100.0, 'unit' => 'Bottle'],
            ['sno' => 16, 'description' => 'Levocetrizine syrup 30ml', 'qty' => 100.0, 'unit' => 'Bottle'],
            ['sno' => 17, 'description' => 'Mefenamic Acid 250mg + Dicyclomine 10mg Tablet', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 18, 'description' => 'METHYLCOBALMIN 750 AND PREGABALIN 75 TAB', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 19, 'description' => 'Metformin 500mg Tablet', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 20, 'description' => 'Metronidazole 400 Mg Tablet', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 21, 'description' => 'Multivitamin Syrup', 'qty' => 300.0, 'unit' => 'Bottle'],
            ['sno' => 22, 'description' => 'Omeprazole 20 Mg + Domperidone 10 Mg Capsule', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 23, 'description' => 'Ondansetron Oral Solution 30ml', 'qty' => 30.0, 'unit' => 'Bottle'],
            ['sno' => 24, 'description' => 'ORS Powder', 'qty' => 300.0, 'unit' => 'Nos'],
            ['sno' => 25, 'description' => 'Paracetamol 500mg Tablet', 'qty' => 3000.0, 'unit' => 'Nos'],
            ['sno' => 26, 'description' => 'Diclo fenac tab 50 mg', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 27, 'description' => 'Prednisolone (5mg)', 'qty' => 1500.0, 'unit' => 'Nos'],
            ['sno' => 28, 'description' => 'Diclofenac Sodium 75 MG/3ML', 'qty' => 500.0, 'unit' => 'Nos'],
            ['sno' => 29, 'description' => 'Glimepiride 2MG + Metformin 500 MG', 'qty' => 1600.0, 'unit' => 'Nos'],
            ['sno' => 30, 'description' => 'Montelukast 10 MG + Levocetirizine 5 MG', 'qty' => 1500.0, 'unit' => 'Nos'],
            ['sno' => 31, 'description' => 'Paracetamol 650', 'qty' => 1500.0, 'unit' => 'Nos'],
            ['sno' => 32, 'description' => 'Aceclofenac & thiocolchicoside', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 33, 'description' => 'Aceclofenac , paracentmol & chlorzoxazone', 'qty' => 1500.0, 'unit' => 'Nos'],
            ['sno' => 34, 'description' => 'Amikacin 500 mg', 'qty' => 500.0, 'unit' => 'Nos'],
            ['sno' => 35, 'description' => 'Amlo 2.5 mg', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 36, 'description' => 'Chymoral forte', 'qty' => 1600.0, 'unit' => 'Nos'],
            ['sno' => 37, 'description' => 'Kuff Q nf strip', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 38, 'description' => 'Etoricoxib 90 mg', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 39, 'description' => 'HB up ( Iron with vit B12 & Folic acid )', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 40, 'description' => 'Domperidone & naproxen soudium 500 mg', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 41, 'description' => 'Rantac 150 mg ( ranitidine )', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 42, 'description' => 'Piroxicam', 'qty' => 200.0, 'unit' => 'Ampolues'],
            ['sno' => 43, 'description' => 'Rantac   ( ranitidine )', 'qty' => 300.0, 'unit' => 'Ampolues'],
            ['sno' => 44, 'description' => 'Mupirocin 2 %', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 45, 'description' => 'Clavum 375 tab', 'qty' => 1500.0, 'unit' => 'Nos'],
            ['sno' => 46, 'description' => 'IV Can fix', 'qty' => 500.0, 'unit' => 'Nos'],
            ['sno' => 47, 'description' => 'Folic Acid 5 mg', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 48, 'description' => 'IV sets', 'qty' => 3000.0, 'unit' => 'Nos'],
            ['sno' => 49, 'description' => 'Kenz', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 50, 'description' => 'Ketomark cream', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 51, 'description' => 'NS 100ML', 'qty' => 600.0, 'unit' => 'Bottle'],
            ['sno' => 52, 'description' => 'NS 250ML', 'qty' => 300.0, 'unit' => 'Bottle'],
            ['sno' => 53, 'description' => 'Hepavion', 'qty' => 200.0, 'unit' => 'Nos'],
            ['sno' => 54, 'description' => 'Face mask', 'qty' => 300.0, 'unit' => 'Nos'],
            ['sno' => 55, 'description' => 'N 95 face mask', 'qty' => 200.0, 'unit' => 'Nos'],
            ['sno' => 56, 'description' => 'Gloves', 'qty' => 500.0, 'unit' => 'Nos'],
            ['sno' => 57, 'description' => 'Evacare', 'qty' => 30.0, 'unit' => 'Bottle'],
            ['sno' => 58, 'description' => '22G cannula', 'qty' => 300.0, 'unit' => 'Nos'],
            ['sno' => 59, 'description' => 'Rantac', 'qty' => 100.0, 'unit' => 'Bottle'],
            ['sno' => 60, 'description' => '24G cannula', 'qty' => 300.0, 'unit' => 'Nos'],
            ['sno' => 61, 'description' => 'Fenobrate 145', 'qty' => 200.0, 'unit' => 'Nos'],
            ['sno' => 62, 'description' => 'Ivf pcm', 'qty' => 500.0, 'unit' => 'Bottle'],
            ['sno' => 63, 'description' => 'Larigo', 'qty' => 30.0, 'unit' => 'Bottle'],
            ['sno' => 64, 'description' => 'Medicaine gel', 'qty' => 100.0, 'unit' => 'Bottle'],
            ['sno' => 65, 'description' => 'Nasal drop adults', 'qty' => 50.0, 'unit' => 'Bottle'],
            ['sno' => 66, 'description' => 'Eldervit', 'qty' => 500.0, 'unit' => 'Ampolues'],
            ['sno' => 67, 'description' => 'Pan 40', 'qty' => 50.0, 'unit' => 'Nos'],
            ['sno' => 68, 'description' => 'Telma 20mg', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 69, 'description' => 'Sporlac saches', 'qty' => 200.0, 'unit' => 'powder'],
            ['sno' => 70, 'description' => 'Amlo AT', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 71, 'description' => 'Tetmovis', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 72, 'description' => 'Pilex forte', 'qty' => 50.0, 'unit' => 'Nos'],
            ['sno' => 73, 'description' => 'Telma AM', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 74, 'description' => 'Orakul', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 75, 'description' => 'Roller bandages', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 76, 'description' => 'Digine', 'qty' => 1080.0, 'unit' => 'Nos'],
            ['sno' => 77, 'description' => 'Medicine pouches(medium size)', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 78, 'description' => 'Medicine pouches(Big size)', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 79, 'description' => 'Cotton rolles(500grm)', 'qty' => 5.0, 'unit' => 'Nos'],
            ['sno' => 80, 'description' => 'Alkavert', 'qty' => 100.0, 'unit' => 'Bottle'],
            ['sno' => 81, 'description' => 'Amoxycillin', 'qty' => 100.0, 'unit' => 'Bottle'],
            ['sno' => 82, 'description' => 'Telmavas 40mg', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 83, 'description' => 'Asthalin', 'qty' => 50.0, 'unit' => 'Bottle'],
            ['sno' => 84, 'description' => 'Azithromycin-250 Mg', 'qty' => 200.0, 'unit' => 'Nos'],
            ['sno' => 85, 'description' => 'B.complex', 'qty' => 1500.0, 'unit' => 'Nos'],
            ['sno' => 86, 'description' => 'Buscopan', 'qty' => 100.0, 'unit' => 'Ampolues'],
            ['sno' => 87, 'description' => 'Levocetrizine', 'qty' => 2000.0, 'unit' => 'Nos'],
            ['sno' => 88, 'description' => 'Ecosprin 75 mg', 'qty' => 500.0, 'unit' => 'Nos'],
            ['sno' => 89, 'description' => 'Liv 52', 'qty' => 20.0, 'unit' => 'Bottle'],
            ['sno' => 90, 'description' => 'Methylcobalmin', 'qty' => 300.0, 'unit' => 'Ampolues'],
            ['sno' => 91, 'description' => 'Mecofol plus', 'qty' => 1000.0, 'unit' => 'Nos'],
            ['sno' => 92, 'description' => 'Nasal drop junior', 'qty' => 50.0, 'unit' => 'Nos'],
            ['sno' => 93, 'description' => 'Terbinafine 250 mg', 'qty' => 300.0, 'unit' => 'Nos'],
            ['sno' => 94, 'description' => 'Zyether', 'qty' => 30.0, 'unit' => 'Ampolues'],
            ['sno' => 95, 'description' => 'cal.d3', 'qty' => 30.0, 'unit' => 'Nos'],
            ['sno' => 96, 'description' => 'Alrest 0.5mg', 'qty' => 300.0, 'unit' => 'Nos'],
            ['sno' => 97, 'description' => 'Nexito plus', 'qty' => 500.0, 'unit' => 'Nos'],
            ['sno' => 98, 'description' => 'Povidine', 'qty' => 100.0, 'unit' => 'Nos'],
            ['sno' => 99, 'description' => 'Mefthalspas', 'qty' => 50.0, 'unit' => 'Bottle'],
            ['sno' => 100, 'description' => 'Medi type', 'qty' => 40.0, 'unit' => 'Nos'],
            ['sno' => 101, 'description' => 'Eye refresh gel', 'qty' => 100.0, 'unit' => 'Nos'],
        ];

        // Find PR-36 in Total Health
        $prs = PurchaseRequisition::where(function ($q) {
                $q->where('pr_number', 'PR-36')
                  ->orWhere('pr_number', 'PR36')
                  ->orWhere('pr_ref', 'PR-36')
                  ->orWhere('pr_ref', 'PR36')
                  ->orWhere('pr_number', 'LIKE', '%PR%36%');
            })
            ->get();

        foreach ($prs as $pr) {
            // Delete old duplicate/repeated items
            $pr->items()->delete();

            $totalEstimated = 0;

            foreach ($cleanItems as $itemData) {
                // Try to match product master in this tenant
                $product = Product::where('tenant_id', $pr->tenant_id)
                    ->where(function ($q) use ($itemData) {
                        $q->where('name', $itemData['description'])
                          ->orWhere('code', $itemData['description']);
                    })->first();

                $estPrice = $product ? (float)$product->estimated_price : 0;
                $catId = $product ? $product->category_id : null;

                PrItem::create([
                    'pr_id'           => $pr->id,
                    'sno'             => $itemData['sno'],
                    'product_id'      => $product?->id,
                    'category_id'     => $catId,
                    'description'     => $itemData['description'],
                    'qty'             => $itemData['qty'],
                    'converted_qty'   => 0,
                    'unit'            => $itemData['unit'] ?: 'Nos',
                    'estimated_price' => $estPrice,
                    'remarks'         => null,
                ]);

                $totalEstimated += ($itemData['qty'] * $estPrice);
            }

            $pr->update([
                'estimated_amount' => $totalEstimated,
            ]);

            PurchaseRequisition::syncPrConversion($pr);
        }
    }

    public function down(): void {}
};
