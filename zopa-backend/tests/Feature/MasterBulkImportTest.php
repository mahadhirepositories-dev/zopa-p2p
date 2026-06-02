<?php

namespace Tests\Feature;

use App\Exports\ProductTemplateExport;
use App\Exports\VendorTemplateExport;
use App\Imports\BoqImport;
use App\Imports\ProductsImport;
use App\Imports\VendorsImport;
use App\Models\Category;
use App\Models\CostCenter;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Vendor;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class MasterBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private Category $cat;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->cat  = Category::firstOrCreate(['tenant_id' => $this->acme->id, 'name' => 'IT Equipment']);
    }

    public function test_product_template_generates(): void
    {
        $raw = Excel::raw(new ProductTemplateExport($this->acme->id), ExcelFormat::XLSX);
        $this->assertNotEmpty($raw);
    }

    public function test_vendor_template_generates(): void
    {
        $raw = Excel::raw(new VendorTemplateExport($this->acme->id), ExcelFormat::XLSX);
        $this->assertNotEmpty($raw);
    }

    public function test_products_import_creates_valid_rows_and_reports_errors(): void
    {
        $import = new ProductsImport($this->acme->id);
        $import->collection(collect([
            ['name' => 'Laptop', 'description' => 'Dell', 'category' => 'IT Equipment', 'subcategory' => '',
             'unit' => 'Nos', 'net_rate' => 50000, 'gst_rate' => 18, 'hsn_code' => '8471', 'warranty_months' => 24, 'product_code' => 'P1'],
            ['name' => 'Bad Row', 'unit' => '', 'net_rate' => 'abc', 'gst_rate' => 18, 'category' => 'Nonexistent'],
            ['name' => ''], // blank → skipped silently
        ]));

        $this->assertEquals(1, $import->created);
        $this->assertCount(1, $import->errors);
        $this->assertStringContainsString('Row 3', $import->errors[0]); // 2nd data row = sheet row 3

        $p = Product::where('tenant_id', $this->acme->id)->where('name', 'Laptop')->first();
        $this->assertNotNull($p);
        $this->assertEquals($this->cat->id, $p->category_id);
        $this->assertEquals(24, $p->warranty_months);
    }

    public function test_vendors_import_resolves_category_and_validates_enums(): void
    {
        $import = new VendorsImport($this->acme->id);
        $import->collection(collect([
            ['name' => 'Acme Supplies', 'vendor_type' => 'manufacturer', 'entity_type' => 'pvt_ltd',
             'gst_status' => 'registered', 'email' => 'a@acme.com', 'category' => 'IT Equipment', 'currency' => 'INR'],
            ['name' => 'Bad Vendor', 'vendor_type' => 'wrong_type'], // invalid enum → error
        ]));

        $this->assertEquals(1, $import->created);
        $this->assertCount(1, $import->errors);

        $v = Vendor::where('tenant_id', $this->acme->id)->where('name', 'Acme Supplies')->first();
        $this->assertNotNull($v);
        $this->assertEquals('manufacturer', $v->vendor_type);
        $this->assertEquals($this->cat->id, $v->category_id);
    }

    public function test_boq_import_parses_po_items(): void
    {
        $import = new BoqImport('po');
        $import->collection(collect([
            ['description' => 'Laptop', 'hsn_code' => '8471', 'qty' => 4, 'unit' => 'Nos', 'net_rate' => 55000, 'gst_rate' => 18, 'required_by' => '2026-07-15', 'warranty_months' => 12],
            ['description' => 'Bad', 'qty' => 0, 'net_rate' => 100, 'gst_rate' => 18], // qty invalid
            ['description' => ''], // skipped
        ]));

        $this->assertCount(1, $import->items);
        $this->assertCount(1, $import->errors);
        $this->assertEquals(4.0, $import->items[0]['qty']);
        $this->assertEquals('2026-07-15', $import->items[0]['required_by']);
        $this->assertEquals(18.0, $import->items[0]['gst_rate']);
    }

    public function test_boq_import_parses_pr_items(): void
    {
        $import = new BoqImport('pr');
        $import->collection(collect([
            ['description' => 'A4 Paper', 'qty' => 10, 'unit' => 'Ream', 'estimated_price' => 280, 'remarks' => 'Urgent'],
        ]));

        $this->assertCount(1, $import->items);
        $this->assertEquals('A4 Paper', $import->items[0]['description']);
        $this->assertEquals(280.0, $import->items[0]['estimated_price']);
        $this->assertEquals('Urgent', $import->items[0]['remarks']);
    }

    public function test_import_endpoint_requires_a_file(): void
    {
        $admin = \App\Models\User::where('email', 'cadmin@acmetest.com')->firstOrFail();
        \Laravel\Sanctum\Sanctum::actingAs($admin);

        $this->withHeader('X-Tenant-ID', (string) $this->acme->id)
            ->postJson('/api/products/import', [])
            ->assertStatus(422);
    }
}
