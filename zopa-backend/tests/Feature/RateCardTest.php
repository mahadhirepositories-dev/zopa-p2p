<?php

namespace Tests\Feature;

use App\Models\{CostCenter, Product, PurchaseOrder, RateCard, Tenant, User, Vendor};
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Rate cards: per-organisation vendor rates for products, their change log, and
 * the PO line rate lock (rate card, else product master rate above zero).
 */
class RateCardTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private Vendor $vendor;
    private Vendor $otherVendor;
    private Product $product;   // master rate 100

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->vendor = Vendor::where('tenant_id', $this->acme->id)->firstOrFail();
        $this->otherVendor = Vendor::create(['tenant_id' => $this->acme->id, 'name' => 'Second Vendor', 'is_active' => true]);
        $this->product = Product::where('tenant_id', $this->acme->id)->firstOrFail();
    }

    private function actingIn(string $email): self
    {
        Sanctum::actingAs(User::where('email', $email)->firstOrFail());
        return $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id]);
    }

    private function card(float $rate, ?Vendor $vendor = null): RateCard
    {
        return RateCard::create([
            'tenant_id' => $this->acme->id, 'vendor_id' => ($vendor ?? $this->vendor)->id,
            'product_id' => $this->product->id, 'net_rate' => $rate,
        ]);
    }

    private function poPayload(array $lines, ?Vendor $vendor = null): array
    {
        return [
            'vendor_id' => ($vendor ?? $this->vendor)->id,
            'cost_center_id' => CostCenter::where('tenant_id', $this->acme->id)->value('id'),
            'po_valid_till' => now()->addDays(20)->toDateString(),
            'freight' => 0,
            'items' => array_map(fn ($l) => ['description' => 'Line', 'qty' => 1, 'gst_rate' => 18, ...$l], $lines),
        ];
    }

    // ── Rate card CRUD and change log ─────────────────────────────────────

    public function test_buyer_manages_a_rate_card_and_every_change_is_logged(): void
    {
        $id = $this->actingIn('cbuyer@acmetest.com')->postJson('/api/rate-cards', [
            'vendor_id' => $this->vendor->id, 'product_id' => $this->product->id, 'net_rate' => 80,
        ])->assertStatus(201)->json('id');

        $this->actingIn('cbuyer@acmetest.com')->putJson("/api/rate-cards/{$id}", ['net_rate' => 85.5])->assertOk();
        // Saving the same rate again is not a change.
        $this->actingIn('cbuyer@acmetest.com')->putJson("/api/rate-cards/{$id}", ['net_rate' => 85.50])->assertOk();
        $this->actingIn('cadmin@acmetest.com')->deleteJson("/api/rate-cards/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('rate_cards', ['id' => $id]);

        $log = $this->actingIn('cbuyer@acmetest.com')
            ->getJson("/api/rate-cards/log?vendor_id={$this->vendor->id}&product_id={$this->product->id}")
            ->assertOk()->json('data');

        $this->assertSame(['deleted', 'updated', 'created'], array_column($log, 'action'));
        $this->assertEquals(['old' => 85.5, 'new' => null], $log[0]['meta']['changes']['net_rate']);
        $this->assertEquals(['old' => 80, 'new' => 85.5], $log[1]['meta']['changes']['net_rate']);
        $this->assertEquals(['old' => null, 'new' => 80], $log[2]['meta']['changes']['net_rate']);
        $this->assertSame('Test Acme Admin', $log[0]['user']['name']);
        $this->assertSame('Test Acme Buyer', $log[1]['user']['name']);
        $this->assertNotNull($log[1]['created_at']);
        // The deleted card's entries stay readable.
        $this->assertSame($this->product->name, $log[0]['meta']['product']);
        $this->assertSame($this->vendor->name, $log[0]['meta']['vendor']);
    }

    public function test_one_rate_card_per_vendor_and_product(): void
    {
        $this->card(80);
        $this->actingIn('cbuyer@acmetest.com')->postJson('/api/rate-cards', [
            'vendor_id' => $this->vendor->id, 'product_id' => $this->product->id, 'net_rate' => 90,
        ])->assertStatus(422)->assertJsonValidationErrors('product_id');

        // A different vendor may have its own rate for the same product.
        $this->actingIn('cbuyer@acmetest.com')->postJson('/api/rate-cards', [
            'vendor_id' => $this->otherVendor->id, 'product_id' => $this->product->id, 'net_rate' => 90,
        ])->assertStatus(201);
    }

    public function test_rate_must_be_above_zero(): void
    {
        $this->actingIn('cbuyer@acmetest.com')->postJson('/api/rate-cards', [
            'vendor_id' => $this->vendor->id, 'product_id' => $this->product->id, 'net_rate' => 0,
        ])->assertStatus(422)->assertJsonValidationErrors('net_rate');
    }

    public function test_permissions_follow_the_matrix(): void
    {
        $card = $this->card(80);

        // Approvers view only.
        $this->actingIn('cl1@acmetest.com')->getJson('/api/rate-cards')->assertOk()->assertJsonCount(1);
        $this->actingIn('cl1@acmetest.com')->getJson('/api/rate-cards/log')->assertOk();
        $this->actingIn('cl1@acmetest.com')->putJson("/api/rate-cards/{$card->id}", ['net_rate' => 1])->assertForbidden();
        // Buyers cannot delete by default.
        $this->actingIn('cbuyer@acmetest.com')->deleteJson("/api/rate-cards/{$card->id}")->assertForbidden();
        // PR users have no access.
        $this->actingIn('cpr@acmetest.com')->getJson('/api/rate-cards')->assertForbidden();

        $this->assertSame('80.00', $card->fresh()->net_rate);
    }

    public function test_rate_cards_are_isolated_per_organisation(): void
    {
        $card = $this->card(80);
        $globex = Tenant::where('code', 'GLBX')->firstOrFail();
        $globexProduct = Product::where('tenant_id', $globex->id)->firstOrFail();

        // Another organisation's product can't be used.
        $this->actingIn('cbuyer@acmetest.com')->postJson('/api/rate-cards', [
            'vendor_id' => $this->vendor->id, 'product_id' => $globexProduct->id, 'net_rate' => 50,
        ])->assertStatus(422)->assertJsonValidationErrors('product_id');

        // Globex's admin can't see, change or delete Acme's card or log.
        Sanctum::actingAs(User::where('email', 'admin@globextest.com')->firstOrFail());
        $h = ['X-Tenant-ID' => (string) $globex->id];
        $this->withHeaders($h)->getJson('/api/rate-cards')->assertOk()->assertJsonCount(0);
        $this->withHeaders($h)->putJson("/api/rate-cards/{$card->id}", ['net_rate' => 1])->assertForbidden();
        $this->withHeaders($h)->deleteJson("/api/rate-cards/{$card->id}")->assertForbidden();
        $this->actingIn('cbuyer@acmetest.com')->putJson("/api/rate-cards/{$card->id}", ['net_rate' => 81])->assertOk();
        Sanctum::actingAs(User::where('email', 'admin@globextest.com')->firstOrFail());
        $this->withHeaders($h)->getJson('/api/rate-cards/log')->assertOk()->assertJsonPath('total', 0);
    }

    // ── Rate lookup ──────────────────────────────────────────────────────

    public function test_lookup_prefers_the_vendors_rate_card_then_the_product_rate(): void
    {
        $free = Product::create(['tenant_id' => $this->acme->id, 'name' => 'Unpriced', 'net_rate' => 0, 'gst_rate' => 18]);
        $this->card(80);

        $this->assertSame(
            [$this->product->id => ['rate' => 80.0, 'source' => 'rate_card']],
            RateCard::lockedRates($this->acme->id, $this->vendor->id, [$this->product->id, $free->id]),
        );
        // No card for the other vendor: the product master rate applies.
        $this->assertSame(
            [$this->product->id => ['rate' => 100.0, 'source' => 'product']],
            RateCard::lockedRates($this->acme->id, $this->otherVendor->id, [$this->product->id]),
        );
        // Another organisation's lookup never sees Acme's card or product.
        $globex = Tenant::where('code', 'GLBX')->firstOrFail();
        $this->assertSame([], RateCard::lockedRates($globex->id, $this->vendor->id, [$this->product->id]));
    }

    // ── PO line lock ─────────────────────────────────────────────────────

    public function test_po_create_requires_the_rate_card_rate(): void
    {
        $this->card(80);

        $this->actingIn('cbuyer@acmetest.com')
            ->postJson('/api/purchase-orders', $this->poPayload([['product_id' => $this->product->id, 'net_rate' => 100]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.net_rate' => "fixed at 80.00 by this vendor's rate card"]);

        $poId = $this->actingIn('cbuyer@acmetest.com')
            ->postJson('/api/purchase-orders', $this->poPayload([['product_id' => $this->product->id, 'net_rate' => 80]]))
            ->assertStatus(201)->json('id');
        $this->assertDatabaseHas('po_items', ['po_id' => $poId, 'net_rate' => 80]);
    }

    public function test_po_falls_back_to_the_locked_product_master_rate(): void
    {
        $this->card(80);   // for the first vendor only

        $this->actingIn('cbuyer@acmetest.com')
            ->postJson('/api/purchase-orders', $this->poPayload([['product_id' => $this->product->id, 'net_rate' => 80]], $this->otherVendor))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.net_rate' => 'fixed at 100.00 by the product master']);

        $this->actingIn('cbuyer@acmetest.com')
            ->postJson('/api/purchase-orders', $this->poPayload([['product_id' => $this->product->id, 'net_rate' => 100]], $this->otherVendor))
            ->assertStatus(201);
    }

    public function test_unpriced_products_and_free_text_lines_stay_editable(): void
    {
        $free = Product::create(['tenant_id' => $this->acme->id, 'name' => 'Unpriced', 'net_rate' => 0, 'gst_rate' => 18]);

        $this->actingIn('cbuyer@acmetest.com')->postJson('/api/purchase-orders', $this->poPayload([
            ['product_id' => $free->id, 'net_rate' => 42],
            ['description' => 'Free text', 'net_rate' => 7.25],
        ]))->assertStatus(201);
    }

    public function test_admins_cannot_override_a_locked_rate(): void
    {
        $this->card(80);
        $this->actingIn('cadmin@acmetest.com')
            ->postJson('/api/purchase-orders', $this->poPayload([['product_id' => $this->product->id, 'net_rate' => 70]]))
            ->assertStatus(422);
    }

    public function test_draft_takes_the_new_rate_card_rate_on_its_next_save(): void
    {
        $card = $this->card(80);
        $payload = $this->poPayload([['product_id' => $this->product->id, 'net_rate' => 80]]);
        $poId = $this->actingIn('cbuyer@acmetest.com')->postJson('/api/purchase-orders', $payload)->assertStatus(201)->json('id');

        $this->actingIn('cbuyer@acmetest.com')->putJson("/api/rate-cards/{$card->id}", ['net_rate' => 90])->assertOk();

        // The draft keeps its saved rate until it is saved again...
        $this->assertDatabaseHas('po_items', ['po_id' => $poId, 'net_rate' => 80]);
        // ...and that save must carry the new rate.
        $this->actingIn('cbuyer@acmetest.com')->putJson("/api/purchase-orders/{$poId}", $payload)
            ->assertStatus(422)->assertJsonValidationErrors('items.0.net_rate');

        $payload['items'][0]['net_rate'] = 90;
        $this->actingIn('cbuyer@acmetest.com')->putJson("/api/purchase-orders/{$poId}", $payload)->assertOk();
        $this->assertDatabaseHas('po_items', ['po_id' => $poId, 'net_rate' => 90]);

        // Changing the vendor on the draft switches to that vendor's rate (product master here).
        $this->actingIn('cbuyer@acmetest.com')->putJson("/api/purchase-orders/{$poId}", $this->poPayload(
            [['product_id' => $this->product->id, 'net_rate' => 90]], $this->otherVendor,
        ))->assertStatus(422)->assertJsonValidationErrors(['items.0.net_rate' => 'fixed at 100.00']);
        $this->assertSame($this->vendor->id, PurchaseOrder::find($poId)->vendor_id);
    }
}
