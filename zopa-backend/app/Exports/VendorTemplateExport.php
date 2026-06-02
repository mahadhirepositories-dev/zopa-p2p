<?php

namespace App\Exports;

use App\Models\Category;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Vendor bulk-import template: a "Vendors" sheet, a "Categories (reference)"
 * sheet listing the tenant's categories to choose from, and an "Allowed Values"
 * sheet documenting the valid options for the dropdown-style fields.
 */
class VendorTemplateExport implements WithMultipleSheets
{
    public function __construct(private int $tenantId) {}

    public function sheets(): array
    {
        return [
            new SimpleSheet(
                'Vendors',
                ['Name', 'Vendor Type', 'Entity Type', 'PAN', 'GSTIN', 'GST Status', 'Email', 'Phone', 'Currency', 'Category', 'Subcategory', 'Account No', 'IFSC', 'Bank Name', 'Branch Name'],
                [
                    ['Acme Industrial Supplies', 'manufacturer', 'pvt_ltd', 'AAACA1234A', '27AAACA1234A1Z5', 'registered', 'sales@acme.com', '9876543210', 'INR', 'IT Equipment', 'Laptops', '1234567890', 'HDFC0000123', 'HDFC Bank', 'MG Road'],
                ],
            ),
            new SimpleSheet(
                'Categories (reference)',
                ['Category', 'Parent Category'],
                $this->categoryRows(),
            ),
            new SimpleSheet(
                'Allowed Values',
                ['Field', 'Allowed values (use exactly one)'],
                [
                    ['Vendor Type', 'manufacturer, distributor, service_provider, consultant'],
                    ['Entity Type', 'public, pvt_ltd, llp, partnership, individual, overseas_company, others'],
                    ['GST Status',  'registered, unregistered, overseas'],
                    ['Currency',    'INR, USD, EUR, GBP, … (ISO code)'],
                ],
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
