<?php

namespace Tests\Feature;

use App\Mail\PurchaseOrderIssuedMail;
use App\Models\CostCenter;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PoVendorMailTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private CostCenter $cc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        Mail::fake();

        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->cc   = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();
    }

    private function makeApprovedPo(?string $vendorEmail): PurchaseOrder
    {
        $vendor = Vendor::create([
            'tenant_id' => $this->acme->id,
            'name'      => 'Mailable Vendor',
            'email'     => $vendorEmail,
            'is_active' => true,
        ]);

        return PurchaseOrder::create([
            'tenant_id'      => $this->acme->id,
            'cost_center_id' => $this->cc->id,
            'vendor_id'      => $vendor->id,
            'po_number'      => 'ACME-PO-TEST-' . uniqid(),
            'net_total'      => 1000,
            'tax_amount'     => 0,
            'grand_total'    => 1000,
            'status'         => 'approved',
            'created_by'     => User::where('email', 'cbuyer@acmetest.com')->firstOrFail()->id,
        ]);
    }

    private function actAsBuyer(): void
    {
        Sanctum::actingAs(User::where('email', 'cbuyer@acmetest.com')->firstOrFail());
    }

    public function test_releasing_po_emails_vendor_when_email_present(): void
    {
        $po = $this->makeApprovedPo('vendor@example.com');

        $this->actAsBuyer();
        $this->withHeader('X-Tenant-ID', (string) $this->acme->id)
            ->postJson("/api/purchase-orders/{$po->id}/release")
            ->assertStatus(200)
            ->assertJsonPath('emailed_to_vendor', true);

        Mail::assertQueued(PurchaseOrderIssuedMail::class, fn ($m) => $m->hasTo('vendor@example.com'));
        $this->assertEquals('released', $po->fresh()->status);
    }

    public function test_releasing_po_without_vendor_email_still_releases(): void
    {
        $po = $this->makeApprovedPo(null);

        $this->actAsBuyer();
        $this->withHeader('X-Tenant-ID', (string) $this->acme->id)
            ->postJson("/api/purchase-orders/{$po->id}/release")
            ->assertStatus(200)
            ->assertJsonPath('emailed_to_vendor', false);

        Mail::assertNotQueued(PurchaseOrderIssuedMail::class);
        $this->assertEquals('released', $po->fresh()->status);
    }

    public function test_send_to_vendor_requires_a_vendor_email(): void
    {
        $po = $this->makeApprovedPo(null);

        $this->actAsBuyer();
        $this->withHeader('X-Tenant-ID', (string) $this->acme->id)
            ->postJson("/api/purchase-orders/{$po->id}/send-to-vendor")
            ->assertStatus(422);
    }

    public function test_vendor_email_is_vendor_facing(): void
    {
        $bill = \App\Models\Location::create([
            'tenant_id' => $this->acme->id, 'name' => 'Acme HO', 'address' => '12 MG Road',
            'city' => 'Bengaluru', 'state' => 'Karnataka', 'state_code' => '29',
            'pincode' => '560001', 'country' => 'India', 'is_active' => true,
        ]);
        $ship = \App\Models\Location::create([
            'tenant_id' => $this->acme->id, 'name' => 'Acme Warehouse', 'address' => 'Plot 7',
            'city' => 'Bengaluru', 'state' => 'Karnataka', 'pincode' => '560099',
            'country' => 'India', 'is_active' => true,
        ]);

        $po = $this->makeApprovedPo('vendor@example.com');
        $po->update(['bill_to_location_id' => $bill->id, 'ship_to_location_id' => $ship->id]);
        \App\Models\PoItem::create([
            'po_id' => $po->id, 'sno' => 1, 'description' => 'Laptop', 'qty' => 2,
            'net_rate' => 50000, 'gst_rate' => 18, 'gross_rate' => 59000, 'amount' => 118000,
            'required_by' => now()->addDays(15)->toDateString(),
        ]);

        $html = (new PurchaseOrderIssuedMail($po->fresh()))->render();

        // Vendor-relevant info present
        $this->assertStringContainsString('Issued By', $html);
        $this->assertStringContainsString('Needed By', $html);
        $this->assertStringContainsString('Bill To', $html);
        $this->assertStringContainsString('Ship To', $html);
        $this->assertStringContainsString('Acme HO', $html);
        $this->assertStringContainsString('Acme Warehouse', $html);
        // Internal-only field must NOT appear
        $this->assertStringNotContainsString('Cost Center', $html);
        // State Code must not leak into the printed address
        $this->assertStringNotContainsString('(29)', $html);
    }

    public function test_send_to_vendor_sends_when_email_present(): void
    {
        $po = $this->makeApprovedPo('vendor@example.com');

        $this->actAsBuyer();
        $this->withHeader('X-Tenant-ID', (string) $this->acme->id)
            ->postJson("/api/purchase-orders/{$po->id}/send-to-vendor")
            ->assertStatus(200);

        Mail::assertQueued(PurchaseOrderIssuedMail::class, fn ($m) => $m->hasTo('vendor@example.com'));
    }
}
