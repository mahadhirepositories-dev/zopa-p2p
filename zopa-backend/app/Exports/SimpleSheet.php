<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

/**
 * A single titled worksheet built from a heading row + plain data rows.
 * Reused to compose multi-sheet template workbooks.
 */
class SimpleSheet implements FromArray, WithHeadings, WithTitle, ShouldAutoSize
{
    public function __construct(
        private string $sheetTitle,
        private array $headingRow,
        private array $dataRows,
    ) {}

    public function array(): array
    {
        return $this->dataRows;
    }

    public function headings(): array
    {
        return $this->headingRow;
    }

    public function title(): string
    {
        return $this->sheetTitle;
    }
}
