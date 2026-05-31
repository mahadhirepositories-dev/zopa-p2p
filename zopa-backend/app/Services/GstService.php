<?php

namespace App\Services;

class GstService
{
    public function calculateTax(float $netAmount, float $gstRate, string $vendorStateCode, string $companyStateCode): array
    {
        $taxAmount = $netAmount * ($gstRate / 100);
        $isSameState = strtoupper($vendorStateCode) === strtoupper($companyStateCode);

        if ($isSameState) {
            return [
                'type' => 'CGST_SGST',
                'cgst' => $taxAmount / 2,
                'sgst' => $taxAmount / 2,
                'igst' => 0,
                'total' => $taxAmount,
            ];
        }

        return [
            'type' => 'IGST',
            'cgst' => 0,
            'sgst' => 0,
            'igst' => $taxAmount,
            'total' => $taxAmount,
        ];
    }

    public function freightTax(float $freight): float
    {
        return $freight / 1.18 * 0.18;
    }

    public function calculatePoTotals(array $items, float $freight, string $vendorStateCode, string $companyStateCode): array
    {
        $netTotal = 0;
        $taxTotal = 0;

        foreach ($items as $item) {
            $netAmt = $item['net_rate'] * $item['qty'];
            $netTotal += $netAmt;
            $tax = $this->calculateTax($netAmt, $item['gst_rate'], $vendorStateCode, $companyStateCode);
            $taxTotal += $tax['total'];
        }

        $taxTotal += $this->freightTax($freight);

        $grandTotal = $netTotal + $freight + $taxTotal;
        $roundOff = round($grandTotal) - $grandTotal;

        return [
            'net_total' => round($netTotal, 2),
            'freight' => round($freight, 2),
            'tax_amount' => round($taxTotal, 2),
            'grand_total' => round($grandTotal, 2),
            'round_off' => round($roundOff, 2),
        ];
    }
}
