<?php

namespace Tests\Feature;

use App\Models\{PurchaseOrder, PoItem, CostCenter, RolePermission, Tenant, User, Vendor};
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PoEditTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private int $ccId;
    private ?int $vendorId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->ccId = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail()->id;
        $this->vendorId = Vendor::query()->value('id');   // any existing vendor (FK-safe)

        RolePermission::updateOrCreate(
            ['role' => 'client_admin', 'module' => 'purchase_orders'],
            ['can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => true],
        );
        Cache::flush();
    }

    private function draftPo(): PurchaseOrder
    {
        $po = PurchaseOrder::create([
            'tenant_id'       => $this->acme->id,
            'cost_center_id'  => $this->ccId,
            'vendor_id'       => $this->vendorId,
            'status'          => 'draft',
            'net_total'       => 200, 'tax_amount' => 36, 'grand_total' => 236,
            'freight'         => 0, 'round_off' => 0,
            'created_by'      => User::where('email', 'cadmin@acmetest.com')->firstOrFail()->id,
            'created_by_role' => 'client_admin',
        ]);
        PoItem::create([
            'po_id' => $po->id, 'sno' => 1, 'description' => 'Item A',
            'qty' => 2, 'net_rate' => 100, 'gst_rate' => 18,
            'gross_rate' => 118, 'amount' => 236, 'warranty_months' => 12,
        ]);
        return $po;
    }

    /** A draft with payment terms + a date round-trip + a linked PR, edited by
     *  the super admin (the actual production user) — load then save. */
    public function test_load_and_edit_rich_draft_as_super_admin(): void
    {
        $cadmin = User::where('email', 'cadmin@acmetest.com')->firstOrFail();

        $pr = \App\Models\PurchaseRequisition::create([
            'tenant_id' => $this->acme->id, 'cost_center_id' => $this->ccId,
            'pr_ref' => 'PR-X-' . uniqid(), 'pr_number' => 'ACME-PR-2026-0001',
            'title' => 'Source PR', 'estimated_amount' => 1000, 'priority' => 'normal',
            'status' => 'converted', 'requested_by' => $cadmin->id,
        ]);

        $po = PurchaseOrder::create([
            'tenant_id' => $this->acme->id, 'cost_center_id' => $this->ccId,
            'vendor_id' => $this->vendorId, 'pr_id' => $pr->id, 'status' => 'draft',
            'net_total' => 200, 'tax_amount' => 36, 'grand_total' => 236, 'freight' => 0, 'round_off' => 0,
            'payment_terms_json' => [['stage' => 'Advance', 'percentage' => 30, 'credit_days' => 0]],
            'po_valid_till' => now()->addDays(20)->toDateString(),
            'created_by' => $cadmin->id, 'created_by_role' => 'client_admin',
        ]);
        $po->prs()->syncWithoutDetaching([$pr->id]);
        PoItem::create([
            'po_id' => $po->id, 'sno' => 1, 'description' => 'Item A',
            'qty' => 2, 'net_rate' => 100, 'gst_rate' => 18, 'gross_rate' => 118, 'amount' => 236,
            'warranty_months' => 12, 'required_by' => now()->addDays(10)->toDateString(),
        ]);

        Sanctum::actingAs(User::where('email', 'superadmin@zopatest.com')->firstOrFail());

        // 1) Load the edit page (GET show)
        $show = $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->withoutExceptionHandling()
            ->getJson("/api/purchase-orders/{$po->id}");
        $show->assertStatus(200);

        // 2) Round-trip the data back like the frontend does on save
        $body = $show->json();
        $payload = [
            'pr_reference'        => $body['pr_reference'] ?? null,
            'vendor_id'           => $body['vendor_id'],
            'vendor_address_id'   => $body['vendor_address_id'] ?? null,
            'cost_center_id'      => $body['cost_center_id'],
            'bill_to_location_id' => $body['bill_to_location_id'] ?? null,
            'ship_to_location_id' => $body['ship_to_location_id'] ?? null,
            'po_valid_till'       => substr((string) $body['po_valid_till'], 0, 10),
            'freight'             => $body['freight'],
            'items' => collect($body['items'])->map(fn ($it) => [
                'product_id' => $it['product_id'], 'description' => $it['description'],
                'category_id' => $it['category_id'], 'qty' => $it['qty'],
                'net_rate' => $it['net_rate'], 'gst_rate' => $it['gst_rate'],
                'warranty_months' => $it['warranty_months'] ?? 0,
                'required_by' => $it['required_by'] ? substr((string) $it['required_by'], 0, 10) : null,
            ])->all(),
            'payment_terms_json' => $body['payment_terms_json'] ?? [],
            'terms_conditions'   => $body['terms_conditions'] ?? '',
        ];

        $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->withoutExceptionHandling()
            ->putJson("/api/purchase-orders/{$po->id}", $payload)
            ->assertStatus(200);
    }

    /** Reproduce the reported "server error" when editing a draft PO. */
    public function test_edit_draft_po_succeeds(): void
    {
        $po = $this->draftPo();

        $payload = [
            'pr_reference'        => null,
            'vendor_id'           => $this->vendorId,
            'vendor_address_id'   => null,
            'cost_center_id'      => $this->ccId,
            'bill_to_location_id' => null,
            'ship_to_location_id' => null,
            'po_valid_till'       => now()->addDays(20)->toDateString(),
            'freight'             => 0,
            'items' => [
                ['product_id' => null, 'description' => 'Item A edited', 'category_id' => null,
                 'qty' => 3, 'unit' => 'Kg', 'net_rate' => 100, 'gst_rate' => 18, 'warranty_months' => 24, 'required_by' => null],
            ],
            'payment_terms_json' => [],
            'terms_conditions'   => 'Some terms',
        ];

        Sanctum::actingAs(User::where('email', 'cadmin@acmetest.com')->firstOrFail());
        $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->withoutExceptionHandling()
            ->putJson("/api/purchase-orders/{$po->id}", $payload)
            ->assertStatus(200);

        // UOM + warranty persist (warranty was previously dropped on edit).
        $this->assertDatabaseHas('po_items', [
            'po_id' => $po->id, 'description' => 'Item A edited', 'unit' => 'Kg', 'warranty_months' => 24,
        ]);

        // Totals are RE-computed from the edited lines, not left stale at 236.
        $po->refresh();
        $this->assertEquals(300.0, (float) $po->net_total);    // 3 × 100
        $this->assertEquals(54.0,  (float) $po->tax_amount);   // 18% of 300
        $this->assertEquals(354.0, (float) $po->grand_total);
    }
}
