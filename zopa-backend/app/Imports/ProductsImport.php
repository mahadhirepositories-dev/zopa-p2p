<?php

namespace App\Imports;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

/**
 * Imports products from the bulk template. Categories are NOT created here —
 * they are resolved by name against the tenant's existing categories (the user
 * adds categories manually first). Each row is validated; invalid rows are
 * skipped and reported so a partial sheet still imports the good rows.
 */
class ProductsImport implements ToCollection, WithHeadingRow
{
    public int $created = 0;
    /** @var array<int,string> */
    public array $errors = [];

    /** lowercase category name => id (current tenant) */
    private array $categoryMap;

    public function __construct(private int $tenantId)
    {
        $this->categoryMap = Category::where('tenant_id', $tenantId)
            ->get()
            ->mapWithKeys(fn ($c) => [mb_strtolower(trim($c->name)) => $c->id])
            ->all();
    }

    public function collection(Collection $rows): void
    {
        foreach ($rows as $index => $row) {
            $line = $index + 2; // +1 for heading row, +1 for 1-based

            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue; // blank line — ignore silently
            }

            $unit    = trim((string) ($row['unit'] ?? ''));
            $netRate = $row['net_rate'] ?? null;
            $gstRate = $row['gst_rate'] ?? null;

            $rowErrors = [];
            if ($unit === '')           $rowErrors[] = 'Unit is required';
            if (!is_numeric($netRate))  $rowErrors[] = 'Net Rate must be a number';
            if (!is_numeric($gstRate))  $rowErrors[] = 'GST Rate must be a number';

            $categoryId = $this->resolveCategory($row['category'] ?? null, 'Category', $rowErrors);
            $subId      = $this->resolveCategory($row['subcategory'] ?? null, 'Subcategory', $rowErrors);

            if ($rowErrors) {
                $this->errors[] = "Row {$line}: " . implode('; ', $rowErrors);
                continue;
            }

            Product::create([
                'tenant_id'       => $this->tenantId,
                'name'            => $name,
                'description'     => trim((string) ($row['description'] ?? '')) ?: null,
                'category_id'     => $categoryId,
                'subcategory_id'  => $subId,
                'unit'            => $unit,
                'net_rate'        => (float) $netRate,
                'gst_rate'        => (float) $gstRate,
                'hsn_code'        => trim((string) ($row['hsn_code'] ?? '')) ?: null,
                'warranty_months' => is_numeric($row['warranty_months'] ?? null) ? (int) $row['warranty_months'] : 0,
                'code'            => trim((string) ($row['product_code'] ?? '')) ?: null,
                'is_active'       => true,
            ]);

            $this->created++;
        }
    }

    private function resolveCategory($value, string $label, array &$rowErrors): ?int
    {
        $name = trim((string) ($value ?? ''));
        if ($name === '' || $name === '—') {
            return null;
        }
        $id = $this->categoryMap[mb_strtolower($name)] ?? null;
        if (!$id) {
            $rowErrors[] = "{$label} '{$name}' not found";
        }
        return $id;
    }
}
