<?php

namespace Tests\Feature;

use App\Models\{CostCenter, OperationalReport, PurchaseOrder, PurchaseRequisition, RolePermission, TatRecord, Tenant, User, Vendor};
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

    public function test_last_month_covers_the_whole_previous_month(): void
    {
        Carbon::setTestNow('2026-03-15 12:00:00');

        foreach ([['2026-02-28 23:59:59', 4, 300], ['2026-03-01 00:00:00', 2, 100], ['2026-01-31 23:59:59', 9, 50]] as [$createdAt, $days, $total]) {
            $po = $this->po(['grand_total' => $total, 'created_at' => $createdAt]);
            TatRecord::create(['po_id' => $po->id, 'po_created_at' => $createdAt, 'po_approved_at' => Carbon::parse($createdAt)->addDays($days)]);
        }

        $last = $this->stats(['period' => 'last_month']);
        $this->assertEquals(4, $last['tat_summary']['avg_approval_days']);
        $this->assertEquals(300, $last['spend']['value']);
        $this->assertEquals(50, $last['spend']['previous_value'], 'A whole month compares with the whole month before');

        $current = $this->stats(['period' => 'this_month']);
        $this->assertEquals(2, $current['tat_summary']['avg_approval_days']);
        $this->assertEquals(100, $current['spend']['value']);
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

    public function test_pr_user_only_receives_pr_figures(): void
    {
        $this->seedOneOfEverything();
        $this->actAs('cpr@acmetest.com');

        $stats = $this->stats();

        $this->assertNoPoFigures($stats);
        $this->assertSame([], $stats['budget_summary']);
        $this->assertNull($stats['latest_operational_report']);
        $this->assertSame([], $stats['po_delivery_tracking']);
        $this->assertSame(0, $stats['attention']['deliveries_delayed']);
        $this->assertStringNotContainsString('PO-SECRET-1', json_encode($stats));
        $this->assertStringNotContainsString(Vendor::find($this->vendorId)->name, json_encode($stats));

        $this->assertEquals(['converted' => 1, 'needs_clarification' => 1, 'submitted' => 1], $stats['pr_counts']);
        $this->assertCount(3, $stats['pr_kpi']);
        $this->assertCount(2, $stats['pending_pr_tracking']);
        $this->assertSame(1, $stats['attention']['prs_needing_clarification']);
        $this->assertSame(1, $stats['attention']['prs_ageing']);
        $this->assertEquals(2, $stats['tat_summary']['avg_pr_tat_days']);
        $this->assertEquals(2, $stats['tat_summary']['avg_pr_tat_net_days']);
    }

    public function test_grn_user_only_receives_delivery_tracking(): void
    {
        $this->seedOneOfEverything();
        $this->actAs('cgrn@acmetest.com');

        $stats = $this->stats();

        $this->assertNoPoFigures($stats);
        $this->assertSame([], $stats['budget_summary']);
        $this->assertNull($stats['latest_operational_report']);

        $this->assertSame([], $stats['pr_counts']);
        $this->assertSame([], $stats['pr_kpi']);
        $this->assertSame([], $stats['pending_pr_tracking']);
        $this->assertSame(0, $stats['attention']['prs_needing_clarification']);
        $this->assertSame(0, $stats['attention']['prs_ageing']);
        $this->assertNull($stats['tat_summary']['avg_pr_tat_days']);
        $this->assertNull($stats['tat_summary']['avg_pr_tat_net_days']);
        $this->assertStringNotContainsString('Secret laptops', json_encode($stats));

        $this->assertSame(['PO-SECRET-1'], array_column($stats['po_delivery_tracking'], 'po_number'));
        $this->assertSame(1, $stats['attention']['deliveries_delayed']);
    }

    public function test_client_admin_and_super_admin_receive_every_section(): void
    {
        $this->seedOneOfEverything();

        $admin = $this->stats();

        $this->assertEquals(98765 + 200 + 300, $admin['spend']['value']);
        $this->assertSame(3, $admin['spend']['count']);
        $this->assertCount(6, $admin['spend']['trend']);
        $this->assertEquals(['approved' => 1, 'released' => 1, 'returned' => 1], $admin['po_counts']);
        $this->assertCount(3, $admin['po_kpi']);
        $this->assertEquals(['converted' => 1, 'needs_clarification' => 1, 'submitted' => 1], $admin['pr_counts']);
        $this->assertCount(3, $admin['pr_kpi']);
        $this->assertCount(2, $admin['pending_pr_tracking']);
        $this->assertSame(['PO-SECRET-1'], array_column($admin['po_delivery_tracking'], 'po_number'));
        $this->assertSame(CostCenter::where('tenant_id', $this->acme->id)->where('is_active', true)->count(), count($admin['budget_summary']));
        $this->assertNotEmpty($admin['budget_summary']);
        $this->assertSame('Secret report', $admin['latest_operational_report']['title']);
        $this->assertEquals([
            'pos_returned' => 1,
            'pos_ready_to_release' => 1,
            'deliveries_delayed' => 1,
            'prs_needing_clarification' => 1,
            'prs_ageing' => 1,
        ], $admin['attention']);
        $this->assertEquals([
            'avg_total_days' => 12,
            'avg_pr_tat_days' => 2,
            'avg_pr_tat_net_days' => 2,
            'avg_approval_days' => 1,
            'avg_release_days' => 1,
            'avg_delivery_days' => 11,
        ], $admin['tat_summary']);

        $this->actAs('superadmin@zopatest.com');

        $this->assertEquals($admin, $this->stats());
    }

    public function test_sections_follow_the_matrix_not_the_role_name(): void
    {
        $this->seedOneOfEverything();
        RolePermission::where('role', 'client_pr')->where('module', 'purchase_orders')->update(['can_view' => true]);
        RolePermission::where('role', 'client_admin')->where('module', 'cost_centers')->update(['can_view' => false]);
        Cache::flush();

        $this->assertSame([], $this->stats()['budget_summary'], 'Client admin had budget view revoked');

        $this->actAs('cpr@acmetest.com');

        $this->assertEquals(98765 + 200 + 300, $this->stats()['spend']['value'], 'PR user was granted PO view');
    }

    public function test_denied_sections_keep_the_response_shape(): void
    {
        $this->seedOneOfEverything();
        $full = $this->stats();

        foreach (['cpr@acmetest.com', 'cgrn@acmetest.com'] as $email) {
            $this->actAs($email);
            $stats = $this->stats();

            $this->assertSame(array_keys($full), array_keys($stats), $email);
            foreach (['tat_summary', 'spend', 'attention'] as $section) {
                $this->assertSame(array_keys($full[$section]), array_keys($stats[$section]), "$email $section");
            }
        }
    }

    private function actAs(string $email): void
    {
        Sanctum::actingAs(User::where('email', $email)->firstOrFail());
    }

    /** Fills every section, so a denied one can't pass just by having nothing to show. */
    private function seedOneOfEverything(): void
    {
        Carbon::setTestNow('2026-03-15 12:00:00');

        $released = $this->po([
            'po_number' => 'PO-SECRET-1', 'status' => 'released', 'grand_total' => 98765,
            'released_at' => now()->subDays(10), 'created_at' => now()->subDays(12),
        ]);
        TatRecord::create([
            'po_id' => $released->id,
            'po_created_at' => now()->subDays(12),
            'po_approved_at' => now()->subDays(11),
            'po_released_at' => now()->subDays(10),
            'po_delivered_at' => now(),
        ]);
        $this->po(['status' => 'approved', 'grand_total' => 200]);
        $this->po(['status' => 'returned', 'grand_total' => 300]);

        $this->pr(['status' => 'needs_clarification']);
        $this->pr(['status' => 'submitted', 'title' => 'Secret laptops', 'created_at' => now()->subDays(9)]);
        $this->pr(['status' => 'converted', 'submitted_at' => now()->subDays(5), 'converted_at' => now()->subDays(3)]);

        OperationalReport::create([
            'tenant_id' => $this->acme->id, 'created_by' => $this->userId, 'title' => 'Secret report',
            'period_start' => now()->subMonth(), 'period_end' => now(), 'status' => 'draft',
        ]);
    }

    private function assertNoPoFigures(array $stats): void
    {
        $this->assertEquals(['value' => 0, 'count' => 0, 'previous_value' => null, 'trend' => []], $stats['spend']);
        $this->assertSame([], $stats['po_counts']);
        $this->assertSame([], $stats['po_kpi']);
        $this->assertSame(0, $stats['attention']['pos_returned']);
        $this->assertSame(0, $stats['attention']['pos_ready_to_release']);
        foreach (['avg_total_days', 'avg_approval_days', 'avg_release_days', 'avg_delivery_days'] as $key) {
            $this->assertNull($stats['tat_summary'][$key], $key);
        }
        $this->assertStringNotContainsString('98765', json_encode($stats));
    }
}
