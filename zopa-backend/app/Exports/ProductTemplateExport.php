<?php

namespace App\Exports;

use App\Models\Category;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Product bulk-import template: a "Products" sheet to fill in, plus a read-only
 * "Categories (reference)" sheet listing the tenant's existing categories so the
 * user knows exactly which Category / Subcategory names are valid.
 */
class ProductTemplateExport implements WithMultipleSheets
{
    public function __construct(private int $tenantId) {}

    public function sheets(): array
    {
        return [
            new SimpleSheet(
                'Products',
                ['Name', 'Description', 'Category', 'Subcategory', 'Unit', 'Net Rate', 'GST Rate', 'HSN Code', 'Warranty Months', 'Product Code'],
                [
                    ['Dell Latitude 5440', '14-inch business laptop', 'IT Equipment', 'Laptops', 'Nos', 55000, 18, '8471', 12, 'PRD-001'],
                    ['A4 Paper Ream', '500 sheets, 75 GSM', 'Office Supplies', '', 'Ream', 280, 12, '4802', 0, ''],
                ],
            ),
            new SimpleSheet(
                'Categories (reference)',
                ['Category', 'Parent Category'],
                $this->categoryRows(),
            ),
        ];
    }

    private function categoryRows(): array
    {
        $rows = Category::where('tenant_id', $this->tenantId)
            ->with('parent:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn ($c) => [$c->name, $c->parent?->name ?? '—'])
            ->all();

        return $rows ?: [['(No categories yet — add categories first, then use their names above.)', '']];
    }
}
