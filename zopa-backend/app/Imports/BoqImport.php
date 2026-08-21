<?php

namespace App\Imports;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Parses a BOQ (line items) template for PO or PR. Does NOT persist anything —
 * returns normalized line items so the creation form can populate its grid and
 * the user reviews/edits before submitting.
 */
class BoqImport implements ToCollection, WithHeadingRow
{
    /** @var array<int,array<string,mixed>> */
    public array $items = [];
    /** @var array<int,string> */
    public array $skippedZeroQty = [];
    /** @var array<int,string> */
    public array $errors = [];

    public function __construct(private string $type) {}

    public function collection(Collection $rows): void
    {
        foreach ($rows as $index => $row) {
            $line = $index + 2;

            $desc = trim((string) ($row['description'] ?? ''));
            if ($desc === '') {
                continue; // blank line
            }

            $qty = $row['qty'] ?? null;
            // Skip rows with zero or empty quantity (standard for full catalog templates)
            if ($qty === null || $qty === '' || (is_numeric($qty) && (float) $qty <= 0)) {
                $this->skippedZeroQty[] = $desc;
                continue;
            }

            if (!is_numeric($qty)) {
                $this->errors[] = "Row {$line}: Qty must be a positive number";
                continue;
            }

            if ($this->type === 'pr') {
                $this->items[] = [
                    'description'     => $desc,
                    'qty'             => (float) $qty,
                    'unit'            => trim((string) ($row['unit'] ?? '')) ?: 'Nos',
                    'estimated_price' => is_numeric($row['estimated_price'] ?? null) ? (float) $row['estimated_price'] : 0,
                    'remarks'         => trim((string) ($row['remarks'] ?? '')) ?: null,
                ];
                continue;
            }

            // PO line item
            $net = $row['net_rate'] ?? null;
            $gst = $row['gst_rate'] ?? null;
            $rowErrors = [];
            if (!is_numeric($net)) $rowErrors[] = 'Net Rate must be a number';
            if (!is_numeric($gst)) $rowErrors[] = 'GST Rate must be a number';
            if ($rowErrors) {
                $this->errors[] = "Row {$line}: " . implode('; ', $rowErrors);
                continue;
            }

            $this->items[] = [
                'description'     => $desc,
                'hsn_code'        => trim((string) ($row['hsn_code'] ?? '')) ?: null,
                'qty'             => (float) $qty,
                'unit'            => trim((string) ($row['unit'] ?? '')) ?: 'Nos',
                'net_rate'        => (float) $net,
                'gst_rate'        => (float) $gst,
                'required_by'     => $this->normalizeDate($row['required_by'] ?? null),
                'warranty_months' => is_numeric($row['warranty_months'] ?? null) ? (int) $row['warranty_months'] : 0,
            ];
        }
    }

    /** Excel cells may be date serials or strings — normalize to Y-m-d (or null). */
    private function normalizeDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        try {
            if (is_numeric($value)) {
                return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d');
            }
            return Carbon::parse((string) $value)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }
}
