<?php

namespace Tests\Feature;

use App\Models\{CostCenter, Location, PoItem, PrItem, PurchaseOrder, PurchaseRequisition,
                TatRecord, Tenant, User, Vendor, VendorAddress};
use App\Services\TatService;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Every figure on the executive dashboard and the weekly report must come from
 * recorded data. With no data they stay empty rather than showing a stand-in.
 */
class ExecutiveDashboardKpiTest extends TestCase
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

    private function stats(): array
    {
        return $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->getJson('/api/executive-dashboard/stats')
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
        return PurchaseRequisition::create($attrs + [
            'tenant_id' => $this->acme->id, 'cost_center_id' => $this->costCenterId, 'pr_ref' => uniqid('PR-'),
            'title' => 'Laptops', 'requested_by' => $this->userId, 'status' => 'converted',
        ]);
    }

    /** A PO line priced at $netRate, optionally traced to a PR line estimated at $estimate. */
    private function poLine(PurchaseOrder $po, float $netRate, float $qty, ?float $estimate = null): PoItem
    {
        $prItemId = null;
        if ($estimate !== null) {
            $prItemId = PrItem::create([
                'pr_id' => $this->pr()->id, 'sno' => 1, 'description' => 'Laptop',
                'qty' => $qty, 'estimated_price' => $estimate,
            ])->id;
        }

        return PoItem::create([
            'po_id' => $po->id, 'sno' => 1, 'pr_item_id' => $prItemId, 'description' => 'Laptop',
            'qty' => $qty, 'net_rate' => $netRate, 'gst_rate' => 18,
            'gross_rate' => $netRate * 1.18, 'amount' => $netRate * 1.18 * $qty,
        ]);
    }

    /** A PO whose vendor address and bill-to location carry these state codes. */
    private function poBetweenStates(?string $vendorState, ?string $billToState, float $total): PurchaseOrder
    {
        $address = VendorAddress::create([
            'vendor_id' => $this->vendorId, 'label' => 'Office', 'address' => 'Street', 'city' => 'City',
            'state' => 'State', 'pincode' => '600001', 'state_code' => $vendorState,
        ]);
        $location = Location::create([
            'tenant_id' => $this->acme->id, 'name' => 'Site ' . uniqid(), 'state_code' => $billToState,
        ]);

        return $this->po([
            'vendor_address_id' => $address->id, 'bill_to_location_id' => $location->id, 'grand_total' => $total,
        ]);
    }

    // ── TAT ─────────────────────────────────────────────────────────────────

    public function test_tat_averages_stay_empty_without_data(): void
    {
        $stats = $this->stats();

        $this->assertNull($stats['avg_pr_tat_days']);
        $this->assertNull($stats['avg_po_issue_tat_days']);
    }

    public function test_pr_tat_leaves_out_clarification_time(): void
    {
        $pr = $this->pr(['total_clarification_duration_seconds' => (int) (1.5 * 86400)]);
        $po = $this->po();
        TatRecord::create([
            'po_id' => $po->id, 'pr_id' => $pr->id,
            'pr_submitted_at' => now()->subDays(5), 'po_created_at' => now(),
        ]);

        $this->assertEquals(3.5, $this->stats()['avg_pr_tat_days']);
    }

    public function test_clarification_stamps_are_stored(): void
    {
        $pr = $this->pr();

        app(TatService::class)->stampPr($pr->id, 'clarification_requested_at', now()->subHours(6));
        app(TatService::class)->stampPr($pr->id, 'clarification_provided_at', now());
        app(TatService::class)->stampPr($pr->id, 'clarification_duration_seconds', 21600);

        $tat = TatRecord::where('pr_id', $pr->id)->firstOrFail();
        $this->assertSame(21600, (int) $tat->clarification_duration_seconds);
        $this->assertEquals(6, $this->stats()['avg_clarification_tat_hours']);
    }

    public function test_no_delay_case_is_invented_without_a_released_po(): void
    {
        $this->pr(['status' => 'submitted']);

        $this->assertNull($this->stats()['max_tat_case']);
    }

    public function test_same_day_release_is_not_a_delay_case(): void
    {
        $this->po(['po_number' => 'P-2', 'approved_at' => now(), 'released_at' => now()]);

        $this->assertNull($this->stats()['max_tat_case']);
    }

    public function test_delay_case_names_the_slowest_recorded_stage(): void
    {
        $this->po([
            'po_number' => 'P-1', 'created_at' => now()->subDays(10),
            'approved_at' => now()->subDays(8), 'released_at' => now(),
        ]);

        $case = $this->stats()['max_tat_case'];

        $this->assertEquals(10, $case['tat_days']);
        $this->assertSame('Approval to vendor release (8 days)', $case['slowest_stage']);
    }

    public function test_delay_stages_report_real_waiting_time(): void
    {
        $this->po(['status' => 'pending_l1', 'created_at' => now()->subDays(10)]);

        $stages = collect($this->stats()['delay_mapping'])->keyBy('stage');

        $this->assertSame(1, $stages['Multi-level Approval']['count']);
        $this->assertEquals(10, $stages['Multi-level Approval']['oldest_days']);
        $this->assertSame('High', $stages['Multi-level Approval']['impact']);

        $this->assertSame(0, $stages['Vendor Order Release']['count']);
        $this->assertNull($stages['Vendor Order Release']['oldest_days']);
        $this->assertSame('None', $stages['Vendor Order Release']['impact']);
    }

    // ── Local procurement ───────────────────────────────────────────────────

    public function test_local_spend_counts_only_same_state_vendors(): void
    {
        $this->poBetweenStates('33', '33', 300);
        $this->poBetweenStates('27', '33', 500);
        $this->poBetweenStates(null, null, 200); // state unknown, so not counted as local

        $stats = $this->stats();

        $this->assertEquals(300, $stats['local_procurement_spend']);
        $this->assertEquals(30, $stats['local_procurement_pct']);
    }

    public function test_local_spend_stays_empty_when_no_po_records_both_states(): void
    {
        $this->po(['grand_total' => 500]);

        $stats = $this->stats();

        $this->assertNull($stats['local_procurement_spend']);
        $this->assertNull($stats['local_procurement_pct']);
    }

    // ── Savings ─────────────────────────────────────────────────────────────

    public function test_category_savings_compare_po_rates_with_pr_estimates(): void
    {
        $this->poLine($this->po(), netRate: 100, qty: 10, estimate: 110);

        $stats = $this->stats();
        $row = $stats['category_spend'][0];

        $this->assertEquals(1100, $row['estimated_budget']);
        $this->assertEquals(100, $row['savings']);
        $this->assertEquals(9.1, $row['savings_pct']);

        $this->assertEquals(100, $stats['total_savings_realized']);
        $this->assertEquals(9.1, $stats['avg_savings_percentage']);
    }

    public function test_paying_more_than_the_estimate_shows_as_a_negative_saving(): void
    {
        $this->poLine($this->po(), netRate: 120, qty: 10, estimate: 100);

        $stats = $this->stats();

        $this->assertEquals(-200, $stats['category_spend'][0]['savings']);
        $this->assertEquals(0, $stats['total_savings_realized']);
    }

    public function test_lines_without_a_pr_estimate_show_no_savings(): void
    {
        $this->poLine($this->po(), netRate: 100, qty: 10);

        $stats = $this->stats();
        $row = $stats['category_spend'][0];

        $this->assertNull($row['estimated_budget']);
        $this->assertNull($row['savings']);
        $this->assertNull($row['savings_pct']);

        $this->assertNull($stats['total_savings_realized']);
        $this->assertNull($stats['avg_savings_percentage']);
    }

    public function test_draft_pos_are_left_out_of_category_spend(): void
    {
        $this->poLine($this->po(['status' => 'draft']), netRate: 100, qty: 10);

        $this->assertSame([], $this->stats()['category_spend']);
    }

    // ── Export ──────────────────────────────────────────────────────────────

    public function test_export_says_no_data_when_tat_is_empty(): void
    {
        $csv = $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->get('/api/executive-dashboard/export')
            ->assertOk()
            ->streamedContent();

        $this->assertStringContainsString('"7. Total Savings Realized","No data"', $csv);
        $this->assertStringContainsString('"8. Average Savings Percentage","No data"', $csv);
        $this->assertStringContainsString('"9. Average PR TAT","No data"', $csv);
        $this->assertStringContainsString('"10. Average PO Issue TAT","No data"', $csv);
        $this->assertStringContainsString('"12. Local Procurement Volume","No data"', $csv);
    }

    // ── Weekly operational report ───────────────────────────────────────────

    private function startReport(): array
    {
        return $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->postJson('/api/operational-reports/start')
            ->assertCreated()
            ->json('report.metrics_data');
    }

    public function test_weekly_report_tat_stays_empty_without_data(): void
    {
        $this->assertNull($this->startReport()['avg_pr_tat_days']);
    }

    public function test_weekly_report_pdf_and_email_say_na_when_tat_is_empty(): void
    {
        $this->startReport();
        $report = \App\Models\OperationalReport::latest('id')->firstOrFail();

        $this->withHeaders(['X-Tenant-ID' => (string) $this->acme->id])
            ->get("/api/operational-reports/{$report->id}/pdf")
            ->assertOk();

        $html = (new \App\Mail\OperationalReportMail(report: $report, pdfBytes: 'pdf', recipientName: 'Reader'))->render();
        $this->assertMatchesRegularExpression('/kpi-num">N\/A</', $html);
    }

    public function test_weekly_report_tat_leaves_out_clarification_time(): void
    {
        $pr = $this->pr(['total_clarification_duration_seconds' => (int) (1.5 * 86400)]);
        $po = $this->po();
        TatRecord::create([
            'po_id' => $po->id, 'pr_id' => $pr->id,
            'pr_submitted_at' => now()->subDays(5), 'po_created_at' => now(),
        ]);

        $this->assertEquals(3.5, $this->startReport()['avg_pr_tat_days']);
    }
}
