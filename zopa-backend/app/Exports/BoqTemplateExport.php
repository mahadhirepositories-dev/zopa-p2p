<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Bill-of-Quantities (line items) template for PO or PR creation. The parsed
 * rows populate the creation form's line-items grid for review before submit.
 */
class BoqTemplateExport implements WithMultipleSheets
{
    public function __construct(private string $type) {}

    public function sheets(): array
    {
        if ($this->type === 'pr') {
            return [
                new SimpleSheet(
                    'PR Items',
                    ['Description', 'Qty', 'Unit', 'Estimated Price', 'Remarks'],
                    [
                        ['A4 Paper Ream', 10, 'Ream', 280, 'Urgent'],
                        ['Heavy Duty Stapler', 5, 'Nos', 400, ''],
                    ],
                ),
            ];
        }

        return [
            new SimpleSheet(
                'PO Items',
                ['Description', 'HSN Code', 'Qty', 'Unit', 'Net Rate', 'GST Rate', 'Required By', 'Warranty Months'],
                [
                    ['Dell Latitude 5440 Laptop', '8471', 4, 'Nos', 55000, 18, '2026-07-15', 12],
                    ['USB-C Docking Station', '8471', 4, 'Nos', 5000, 18, '', 12],
                ],
            ),
        ];
    }
}
