<?php

namespace App\Imports;

use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
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
    /** lowercase product codes already in DB */
    private array $existingCodes;
    /** lowercase product names already in DB */
    private array $existingNames;
    /** lowercase codes seen in this import session */
    private array $seenCodesInImport = [];
    /** lowercase names seen in this import session */
    private array $seenNamesInImport = [];

    public function __construct(private int $tenantId)
    {
        $this->categoryMap = Category::where('tenant_id', $tenantId)
            ->get()
            ->mapWithKeys(fn ($c) => [mb_strtolower(trim($c->name)) => $c->id])
            ->all();

        $existingProducts = Product::where('tenant_id', $tenantId)->get();

        $this->existingCodes = $existingProducts
            ->pluck('code')
            ->filter()
            ->map(fn ($c) => mb_strtolower(trim($c)))
            ->toArray();

        $this->existingNames = $existingProducts
            ->pluck('name')
            ->filter()
            ->map(fn ($n) => mb_strtolower(trim($n)))
            ->toArray();
    }

    public function collection(Collection $rows): void
    {
        $tenant = Tenant::find($this->tenantId);

        foreach ($rows as $index => $row) {
            $line = $index + 2; // +1 for heading row, +1 for 1-based

            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue; // blank line — ignore silently
            }

            $code = trim((string) ($row['product_code'] ?? $row['code'] ?? ''));
            $unit    = trim((string) ($row['unit'] ?? ''));
            $netRate = $row['net_rate'] ?? null;
            $gstRate = $row['gst_rate'] ?? null;

            $rowErrors = [];
            if ($unit === '')           $rowErrors[] = 'Unit is required';
            if (!is_numeric($netRate))  $rowErrors[] = 'Net Rate must be a number';
            if (!is_numeric($gstRate))  $rowErrors[] = 'GST Rate must be a number';

            // Validate Product Code Uniqueness
            if ($code !== '') {
                $codeLower = mb_strtolower($code);
                if (in_array($codeLower, $this->existingCodes, true)) {
                    $rowErrors[] = "Product Code '{$code}' already exists in database";
                } elseif (in_array($codeLower, $this->seenCodesInImport, true)) {
                    $rowErrors[] = "Duplicate Product Code '{$code}' in import file";
                } else {
                    $this->seenCodesInImport[] = $codeLower;
                }
            }

            // Validate Product Name Uniqueness
            $nameLower = mb_strtolower($name);
            if (in_array($nameLower, $this->existingNames, true)) {
                $rowErrors[] = "Product Name '{$name}' already exists in database";
            } elseif (in_array($nameLower, $this->seenNamesInImport, true)) {
                $rowErrors[] = "Duplicate Product Name '{$name}' in import file";
            } else {
                $this->seenNamesInImport[] = $nameLower;
            }

            $categoryId = $this->resolveCategory($row['category'] ?? null, 'Category', $rowErrors);
            $subId      = $this->resolveCategory($row['subcategory'] ?? null, 'Subcategory', $rowErrors);

            if ($rowErrors) {
                $this->errors[] = "Row {$line}: " . implode('; ', $rowErrors);
                continue;
            }

            // Auto-generate code if empty
            if ($code === '') {
                $prefix = !empty($tenant?->product_prefix) ? $tenant->product_prefix : 'PRD-';
                $series = $tenant?->product_series ?? 1;
                do {
                    $code = $prefix . str_pad($series++, 4, '0', STR_PAD_LEFT);
                } while (in_array(mb_strtolower($code), $this->existingCodes, true) || in_array(mb_strtolower($code), $this->seenCodesInImport, true));
                if ($tenant) {
                    $tenant->increment('product_series', $series - ($tenant->product_series ?? 1));
                }
                $this->seenCodesInImport[] = mb_strtolower($code);
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
                'code'            => $code,
                'is_active'       => true,
            ]);

            // Add created item to existing set so subsequent rows in same batch see it
            $this->existingCodes[] = mb_strtolower($code);
            $this->existingNames[] = mb_strtolower($name);
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
