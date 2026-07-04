<?php

namespace Tests\Unit;

use App\Services\GstService;
use PHPUnit\Framework\TestCase;

class GstServiceTest extends TestCase
{
    private GstService $gst;

    protected function setUp(): void
    {
        parent::setUp();
        $this->gst = new GstService();
    }

    public function test_freight_gst_is_applied_on_top_of_freight(): void
    {
        // One line: 10 x 100 = 1000 net, 18% = 180 tax.
        // Freight 500 @ 12% = 60 freight tax. Same-state (CGST+SGST) split is
        // irrelevant to the aggregate tax_amount.
        $totals = $this->gst->calculatePoTotals(
            [['net_rate' => 100, 'qty' => 10, 'gst_rate' => 18]],
            500.0,      // freight
            '29', '29', // same state
            12.0        // freight GST rate
        );

        $this->assertEquals(1000, $totals['net_total']);
        $this->assertEquals(240, $totals['tax_amount']);   // 180 line + 60 freight
        $this->assertEquals(1740, $totals['grand_total']); // 1000 + 500 + 240
    }

    public function test_zero_freight_rate_adds_no_freight_tax(): void
    {
        $totals = $this->gst->calculatePoTotals(
            [['net_rate' => 100, 'qty' => 2, 'gst_rate' => 18]],
            300.0,       // freight, but…
            '29', '07',  // inter-state
            0.0          // …0% freight GST
        );

        $this->assertEquals(200, $totals['net_total']);
        $this->assertEquals(36, $totals['tax_amount']);    // only the line GST
        $this->assertEquals(536, $totals['grand_total']);  // 200 + 300 + 36
    }
}
