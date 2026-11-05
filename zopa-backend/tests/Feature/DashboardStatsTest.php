<?php

namespace Tests\Feature;

use App\Models\{CostCenter, PurchaseOrder, PurchaseRequisition, TatRecord, Tenant, User, Vendor};
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The main dashboard's figures come from recorded data. With no data they stay
 * empty rather than reading as a real zero.
 */
class DashboardStatsTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private int $costCenterId;
    private int $vendorId;
    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->costCenterId = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail()->id;
        $this->vendorId = Vendor::where('tenant_id', $this->acme->id)->firstOrFail()->id;
        $user = User::where('email', 'cadmin@acmetest.com')->firstOrFail();
        $this->userId = $user->id;
        Sanctum::actingAs($user);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function stats(array $query = []): array
    {
        return $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->getJson('/api/dashboard/stats?' . http_build_query($query))
            ->assertOk()
            ->json();
    }

    private function po(array $attrs = []): PurchaseOrder
    {
        $createdAt = $attrs['created_at'] ?? null;
        unset($attrs['created_at']);

        $po = PurchaseOrder::create($attrs + [
            'tenant_id' => $this->acme->id, 'cost_center_id' => $this->costCenterId,
            'vendor_id' => $this->vendorId, 'status' => 'released', 'grand_total' => 100,
            'freight' => 0, 'created_by' => $this->userId,
        ]);

        if ($createdAt) {
            $po->created_at = $createdAt;
            $po->save();
        }

        return $po;
    }

    private function pr(array $attrs = []): PurchaseRequisition
    {
        $createdAt = $attrs['created_at'] ?? null;
        unset($attrs['created_at']);

        $pr = PurchaseRequisition::create($attrs + [
            'tenant_id' => $this->acme->id, 'cost_center_id' => $this->costCenterId, 'pr_ref' => uniqid('PR-'),
            'title' => 'Laptops', 'requested_by' => $this->userId, 'status' => 'submitted',
        ]);

        if ($createdAt) {
            $pr->created_at = $createdAt;
            $pr->save();
        }

        return $pr;
    }

    public function test_cycle_times_are_empty_rather_than_zero_without_data(): void
    {
        $stats = $this->stats();

        foreach (['avg_total_days', 'avg_pr_tat_days', 'avg_pr_tat_net_days', 'avg_approval_days', 'avg_release_days', 'avg_delivery_days'] as $key) {
            $this->assertNull($stats['tat_summary'][$key], $key);
        }
    }

    public function test_total_cycle_time_only_counts_delivered_orders(): void
    {
        $po = $this->po(['status' => 'released']);
        TatRecord::create([
            'po_id' => $po->id,
            'po_created_at' => now()->subDays(6),
            'po_approved_at' => now()->subDays(4),
            'po_released_at' => now()->subDays(3),
        ]);

        $tat = $this->stats()['tat_summary'];

        $this->assertEquals(2, $tat['avg_approval_days']);
        $this->assertEquals(1, $tat['avg_release_days']);
        $this->assertNull($tat['avg_delivery_days']);
        $this->assertNull($tat['avg_total_days'], 'A release is not a delivery');

        TatRecord::where('po_id', $po->id)->update(['po_delivered_at' => now()]);

        $this->assertEquals(6, $this->stats()['tat_summary']['avg_total_days']);
    }

    public function test_cycle_times_follow_the_period_filter(): void
    {
        $old = $this->po(['created_at' => now()->subMonths(3)]);
        TatRecord::create([
            'po_id' => $old->id,
            'po_created_at' => now()->subMonths(3),
            'po_approved_at' => now()->subMonths(3)->addDays(10),
        ]);

        $this->assertEquals(10, $this->stats()['tat_summary']['avg_approval_days']);
        $this->assertNull($this->stats(['period' => 'this_month'])['tat_summary']['avg_approval_days']);
    }

    public function test_po_value_matches_the_executive_dashboard(): void
    {
        $this->po(['status' => 'released', 'grand_total' => 1000]);
        $this->po(['status' => 'pending_l1', 'grand_total' => 500]);
        $this->po(['status' => 'draft', 'grand_total' => 70]);
        $this->po(['status' => 'cancelled', 'grand_total' => 30]);

        $spend = $this->stats()['spend'];

        $this->assertEquals(1500, $spend['value']);
        $this->assertSame(2, $spend['count']);

        $executive = $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->getJson('/api/executive-dashboard/stats')->assertOk()->json();

        $this->assertEquals($executive['total_value_managed'], $spend['value']);
        $this->assertSame($executive['orders_processed'], $spend['count']);
    }

    public function test_po_value_compares_with_the_same_point_last_month(): void
    {
        Carbon::setTestNow('2026-03-15 12:00:00');

        $this->po(['grand_total' => 100, 'created_at' => '2026-03-10 09:00:00']);
        $this->po(['grand_total' => 40, 'created_at' => '2026-02-10 09:00:00']);
        $this->po(['grand_total' => 999, 'created_at' => '2026-02-20 09:00:00']);

        $spend = $this->stats(['period' => 'this_month'])['spend'];

        $this->assertEquals(100, $spend['value']);
        $this->assertEquals(40, $spend['previous_value'], 'Later in February is past the same point');
        $this->assertNull($this->stats()['spend']['previous_value'], 'All time has nothing to compare with');
    }

    public function test_po_value_trend_covers_six_months_whatever_the_period(): void
    {
        Carbon::setTestNow('2026-03-15 12:00:00');

        $this->po(['grand_total' => 100, 'created_at' => '2026-01-10 09:00:00']);
        $this->po(['grand_total' => 50, 'created_at' => '2026-03-10 09:00:00']);
        $this->po(['grand_total' => 25, 'status' => 'draft', 'created_at' => '2026-03-11 09:00:00']);
        $this->po(['grand_total' => 999, 'created_at' => '2025-09-30 09:00:00']);

        $trend = $this->stats(['period' => 'today'])['spend']['trend'];

        $this->assertSame(
            ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'],
            array_column($trend, 'month')
        );
        $this->assertEquals([0, 0, 0, 100, 0, 50], array_column($trend, 'value'));
    }

    public function test_attention_counts_are_live_and_ignore_the_period_filter(): void
    {
        $longAgo = now()->subMonths(4);

        $this->po(['status' => 'approved', 'created_at' => $longAgo]);
        $this->po(['status' => 'returned', 'created_at' => $longAgo]);
        $this->po(['status' => 'released', 'released_at' => now()->subDays(10), 'created_at' => $longAgo]);
        $this->po(['status' => 'released', 'released_at' => now()->subDays(2), 'created_at' => $longAgo]);
        $this->po(['status' => 'delivered', 'released_at' => now()->subDays(30), 'created_at' => $longAgo]);

        $this->pr(['status' => 'needs_clarification', 'created_at' => $longAgo]);
        $this->pr(['status' => 'submitted', 'created_at' => $longAgo]);
        $this->pr(['status' => 'submitted', 'created_at' => now()->subDays(2)]);
        $this->pr(['status' => 'draft', 'created_at' => $longAgo]);
        $this->pr(['status' => 'converted', 'created_at' => $longAgo]);

        $expected = [
            'pos_returned' => 1,
            'pos_ready_to_release' => 1,
            'deliveries_delayed' => 1,
            'prs_needing_clarification' => 1,
            'prs_ageing' => 1,
        ];

        $this->assertEquals($expected, $this->stats()['attention']);
        $this->assertEquals($expected, $this->stats(['period' => 'today'])['attention']);
    }

    public function test_attention_counts_stay_inside_the_tenant(): void
    {
        $globex = Tenant::where('code', 'GLBX')->firstOrFail();
        $this->po([
            'tenant_id' => $globex->id,
            'cost_center_id' => CostCenter::where('tenant_id', $globex->id)->firstOrFail()->id,
            'vendor_id' => Vendor::where('tenant_id', $globex->id)->firstOrFail()->id,
            'status' => 'approved',
        ]);

        $stats = $this->stats();

        $this->assertSame(0, $stats['attention']['pos_ready_to_release']);
        $this->assertEquals(0, $stats['spend']['value']);
    }

    public function test_tracking_lists_show_the_longest_waiting_first(): void
    {
        $this->pr(['status' => 'draft', 'title' => 'Old draft', 'created_at' => now()->subDays(40)]);
        $this->pr(['status' => 'submitted', 'title' => 'Newer', 'created_at' => now()->subDays(3)]);
        $this->pr(['status' => 'submitted', 'title' => 'Older', 'created_at' => now()->subDays(9)]);

        $older = $this->po(['released_at' => now()->subDays(12)]);
        $newer = $this->po(['released_at' => now()->subDays(1)]);

        $stats = $this->stats();

        $this->assertSame(['Older', 'Newer', 'Old draft'], array_column($stats['pending_pr_tracking'], 'title'));
        $this->assertSame([$older->id, $newer->id], array_column($stats['po_delivery_tracking'], 'id'));
    }
}
