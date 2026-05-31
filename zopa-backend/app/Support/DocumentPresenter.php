<?php

namespace App\Support;

/**
 * Normalises a Purchase Order or Purchase Requisition into a flat, mail-safe
 * structure (title, document number, header rows, line items) so the email
 * Blade templates stay logic-free and identical for both document types.
 */
class DocumentPresenter
{
    /**
     * @param  object  $entity      PurchaseOrder | PurchaseRequisition (relations loaded)
     * @param  string  $entityType  'PO' | 'PR'
     * @return array{0:string,1:string,2:array<string,string>,3:array<int,array<string,mixed>>}
     */
    public static function present(object $entity, string $entityType): array
    {
        return $entityType === 'PO'
            ? self::presentPo($entity)
            : self::presentPr($entity);
    }

    private static function presentPo(object $po): array
    {
        $title  = 'Purchase Order';
        $number = $po->po_number ?: 'Draft';

        $headerRows = [
            'Vendor'      => optional($po->vendor)->name ?? '—',
            'Cost Center' => optional($po->costCenter)->name ?? '—',
            'PO Date'     => $po->po_date ? \Illuminate\Support\Carbon::parse($po->po_date)->format('d M Y') : '—',
            'Valid Till'  => $po->po_valid_till ? \Illuminate\Support\Carbon::parse($po->po_valid_till)->format('d M Y') : '—',
            'Net Total'   => 'Rs ' . number_format((float) $po->net_total, 2),
            'Tax'         => 'Rs ' . number_format((float) $po->tax_amount, 2),
            'Grand Total' => 'Rs ' . number_format((float) $po->grand_total, 2),
        ];

        $items = [];
        foreach ($po->items as $i => $it) {
            $items[] = [
                'sno'         => $it->sno ?? ($i + 1),
                'description' => $it->description ?? optional($it->product)->name ?? '—',
                'qty'         => rtrim(rtrim(number_format((float) $it->qty, 3), '0'), '.'),
                'unit'        => $it->unit ?? optional($it->product)->unit ?? 'Nos',
                'rate'        => number_format((float) ($it->net_rate ?? 0), 2),
                'tax'         => rtrim(rtrim(number_format((float) ($it->gst_rate ?? 0), 2), '0'), '.') . '%',
                'amount'      => number_format((float) ($it->amount ?? ((float) $it->qty * (float) ($it->net_rate ?? 0))), 2),
            ];
        }

        return [$title, $number, $headerRows, $items];
    }

    private static function presentPr(object $pr): array
    {
        $title  = 'Purchase Requisition';
        $number = $pr->pr_number ?: 'Draft';

        $headerRows = [
            'Title'            => $pr->title ?? '—',
            'Cost Center'      => optional($pr->costCenter)->name ?? '—',
            'Priority'         => $pr->priority ? ucfirst($pr->priority) : 'Normal',
            'Required By'      => $pr->required_by_date ? \Illuminate\Support\Carbon::parse($pr->required_by_date)->format('d M Y') : '—',
            'Estimated Amount' => 'Rs ' . number_format((float) $pr->estimated_amount, 2),
            'Requested By'     => optional($pr->requestedBy)->name ?? '—',
        ];

        $items = [];
        foreach ($pr->items as $i => $it) {
            $rate   = (float) ($it->estimated_price ?? 0);
            $qty    = (float) $it->qty;
            $items[] = [
                'sno'         => $it->sno ?? ($i + 1),
                'description' => $it->description ?? '—',
                'qty'         => rtrim(rtrim(number_format($qty, 3), '0'), '.'),
                'unit'        => $it->unit ?? 'Nos',
                'rate'        => number_format($rate, 2),
                'tax'         => '—',
                'amount'      => number_format($qty * $rate, 2),
            ];
        }

        return [$title, $number, $headerRows, $items];
    }
}
