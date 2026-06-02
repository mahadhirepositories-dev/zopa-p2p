<?php

namespace App\Imports;

use App\Models\Category;
use App\Models\Vendor;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

/**
 * Imports vendors from the bulk template. Categories are resolved by name
 * against existing tenant categories. Enum-like fields are validated against
 * their allowed values; bad rows are skipped and reported.
 */
class VendorsImport implements ToCollection, WithHeadingRow
{
    public int $created = 0;
    /** @var array<int,string> */
    public array $errors = [];

    private array $categoryMap;

    private const VENDOR_TYPES = ['manufacturer', 'distributor', 'service_provider', 'consultant'];
    private const ENTITY_TYPES = ['public', 'pvt_ltd', 'llp', 'partnership', 'individual', 'overseas_company', 'others'];
    private const GST_STATUSES = ['registered', 'unregistered', 'overseas'];

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
            $line = $index + 2;

            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $rowErrors = [];

            $vendorType = $this->enum($row['vendor_type'] ?? null, self::VENDOR_TYPES, 'Vendor Type', $rowErrors);
            $entityType = $this->enum($row['entity_type'] ?? null, self::ENTITY_TYPES, 'Entity Type', $rowErrors);
            $gstStatus  = $this->enum($row['gst_status'] ?? null, self::GST_STATUSES, 'GST Status', $rowErrors);

            $categoryId = $this->resolveCategory($row['category'] ?? null, 'Category', $rowErrors);
            $subId      = $this->resolveCategory($row['subcategory'] ?? null, 'Subcategory', $rowErrors);

            if ($rowErrors) {
                $this->errors[] = "Row {$line}: " . implode('; ', $rowErrors);
                continue;
            }

            Vendor::create([
                'tenant_id'      => $this->tenantId,
                'name'           => $name,
                'vendor_type'    => $vendorType,
                'entity_type'    => $entityType,
                'pan'            => $this->upper($row['pan'] ?? null),
                'gstin'          => $this->upper($row['gstin'] ?? null),
                'gst_status'     => $gstStatus,
                'email'          => trim((string) ($row['email'] ?? '')) ?: null,
                'phone'          => trim((string) ($row['phone'] ?? '')) ?: null,
                'currency'       => trim((string) ($row['currency'] ?? '')) ?: 'INR',
                'category_id'    => $categoryId,
                'subcategory_id' => $subId,
                'account_no'     => trim((string) ($row['account_no'] ?? '')) ?: null,
                'ifsc'           => $this->upper($row['ifsc'] ?? null),
                'bank_name'      => trim((string) ($row['bank_name'] ?? '')) ?: null,
                'branch_name'    => trim((string) ($row['branch_name'] ?? '')) ?: null,
                'is_active'      => true,
            ]);

            $this->created++;
        }
    }

    private function enum($value, array $allowed, string $label, array &$rowErrors): ?string
    {
        $v = mb_strtolower(trim((string) ($value ?? '')));
        if ($v === '') {
            return null;
        }
        if (!in_array($v, $allowed, true)) {
            $rowErrors[] = "{$label} '{$value}' is not valid";
            return null;
        }
        return $v;
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

    private function upper($value): ?string
    {
        $v = trim((string) ($value ?? ''));
        return $v !== '' ? mb_strtoupper($v) : null;
    }
}
