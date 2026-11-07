<?php

namespace Tests\Feature;

use App\Models\{CostCenter, PurchaseOrder, TatRecord, Tenant, User, Vendor};
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The ZOPA Admin Dashboard's turnaround figures say so when nothing was measured,
 * rather than reading as zero days.
 */
class AdminDashboardStatsTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        Sanctum::actingAs(User::where('email', 'superadmin@zopatest.com')->firstOrFail());
    }

    private function stats(array $query = []): array
    {
        return $this->getJson('/api/admin/dashboard/stats?' . http_build_query($query))->assertOk()->json();
    }

    private function po(array $attrs = []): PurchaseOrder
    {
        $createdAt = $attrs['created_at'] ?? null;
        unset($attrs['created_at']);

        $po = PurchaseOrder::create($attrs + [
            'tenant_id' => $this->acme->id,
            'cost_center_id' => CostCenter::where('tenant_id', $this->acme->id)->firstOrFail()->id,
            'vendor_id' => Vendor::where('tenant_id', $this->acme->id)->firstOrFail()->id,
            'status' => 'released', 'grand_total' => 100, 'freight' => 0,
            'created_by' => User::where('email', 'cadmin@acmetest.com')->firstOrFail()->id,
        ]);

        if ($createdAt) {
            $po->created_at = $createdAt;
            $po->save();
        }

        return $po;
    }

    /** @return array<int, array<string, mixed>> */
    private function scopes(): array
    {
        return [[], ['tenant_id' => $this->acme->id]];
    }

    public function test_turnaround_is_empty_rather_than_zero_without_data(): void
    {
        foreach ($this->scopes() as $scope) {
            foreach (['avg_approval_days', 'avg_release_days', 'avg_delivery_days', 'avg_total_days'] as $key) {
                $this->assertNull($this->stats($scope)['tat_summary'][$key], $key);
            }
        }
    }

    public function test_total_cycle_only_counts_delivered_orders(): void
    {
        $po = $this->po();
        TatRecord::create([
            'po_id' => $po->id,
            'po_created_at' => now()->subDays(6),
            'po_approved_at' => now()->subDays(4),
            'po_released_at' => now()->subDays(3),
        ]);

        foreach ($this->scopes() as $scope) {
            $tat = $this->stats($scope)['tat_summary'];
            $this->assertEquals(2, $tat['avg_approval_days']);
            $this->assertNull($tat['avg_total_days'], 'A release is not a delivery');
        }

        TatRecord::where('po_id', $po->id)->update(['po_delivered_at' => now()]);

        foreach ($this->scopes() as $scope) {
            $this->assertEquals(6, $this->stats($scope)['tat_summary']['avg_total_days']);
        }
    }

    public function test_turnaround_follows_the_period_filter(): void
    {
        $old = $this->po(['created_at' => now()->subMonths(3)]);
        TatRecord::create([
            'po_id' => $old->id,
            'po_created_at' => now()->subMonths(3),
            'po_approved_at' => now()->subMonths(3)->addDays(10),
        ]);

        foreach ($this->scopes() as $scope) {
            $this->assertEquals(10, $this->stats($scope)['tat_summary']['avg_approval_days']);
            $this->assertNull($this->stats($scope + ['period' => 'this_month'])['tat_summary']['avg_approval_days']);
        }
    }

    public function test_last_month_and_this_month_meet_at_the_month_boundary(): void
    {
        foreach ([[now()->startOfMonth()->subSecond(), 4], [now()->startOfMonth(), 2]] as [$createdAt, $days]) {
            $po = $this->po(['created_at' => $createdAt]);
            TatRecord::create(['po_id' => $po->id, 'po_created_at' => $createdAt, 'po_approved_at' => $createdAt->copy()->addDays($days)]);
        }

        foreach ($this->scopes() as $scope) {
            $last = $this->stats($scope + ['period' => 'last_month']);
            $this->assertEquals(4, $last['tat_summary']['avg_approval_days']);
            $this->assertSame(1, $last['po']['total']);

            $current = $this->stats($scope + ['period' => 'this_month']);
            $this->assertEquals(2, $current['tat_summary']['avg_approval_days']);
            $this->assertSame(1, $current['po']['total']);
        }
    }

    public function test_export_says_no_data_instead_of_zero_days(): void
    {
        $csv = $this->get('/api/admin/dashboard/export')->assertOk()->streamedContent();

        $this->assertStringContainsString('"PO Approval TAT","No data"', $csv);
        $this->assertStringNotContainsString(' days', $csv);
    }
}
