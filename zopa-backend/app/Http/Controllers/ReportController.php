<?php

namespace App\Http\Controllers;

use App\Models\TatRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Barryvdh\DomPDF\Facade\Pdf;

class ReportController extends Controller
{
    /**
     * TAT report: PR→PO Draft, PR→Approval, PR→Release, PR→Delivery, PR→Invoice
     */
    public function poTat(Request $request): JsonResponse|Response
    {
        $tenant = app('currentTenant');

        $query = TatRecord::with([
            'po:id,po_number,cost_center_id,status,grand_total',
            'po.costCenter:id,name',
            'po.vendor:id,name',
            'pr:id,pr_number,title',
        ])
            ->whereHas('po', fn($q) => $q->where('tenant_id', $tenant->id));

        if ($request->has('from')) {
            $query->where('po_created_at', '>=', $request->from);
        }
        if ($request->has('to')) {
            $query->where('po_created_at', '<=', $request->to . ' 23:59:59');
        }
        if ($request->has('cost_center_id')) {
            $query->whereHas('po', fn($q) => $q->where('cost_center_id', $request->cost_center_id));
        }

        $records = $query->latest('po_created_at')->get();

        $rows = $records->map(fn($r) => $this->buildRow($r));

        if ($request->has('export')) {
            return match ($request->export) {
                'csv'  => $this->exportCsv($rows),
                'pdf'  => $this->exportPdf($rows, $tenant),
                default => response()->json($rows),
            };
        }

        return response()->json($rows);
    }

    private function buildRow(TatRecord $r): array
    {
        $diff = fn($a, $b) => ($a && $b) ? round($a->diffInHours($b) / 24, 1) : null;

        return [
            'po_number'          => $r->po?->po_number ?? '—',
            'po_status'          => $r->po?->status ?? '—',
            'vendor'             => $r->po?->vendor?->name ?? '—',
            'cost_center'        => $r->po?->costCenter?->name ?? '—',
            'pr_number'          => $r->pr?->pr_number ?? '—',
            'pr_title'           => $r->pr?->title ?? '—',
            'grand_total'        => $r->po?->grand_total,
            'po_created_at'      => $r->po_created_at?->toDateString(),
            'po_approved_at'     => $r->po_approved_at?->toDateString(),
            'po_released_at'     => $r->po_released_at?->toDateString(),
            'po_delivered_at'    => $r->po_delivered_at?->toDateString(),
            'invoice_approved_at'=> $r->invoice_approved_at?->toDateString(),
            // TATs in days
            'tat_pr_to_po'       => $diff($r->pr_submitted_at, $r->po_created_at),
            'tat_pr_to_approval' => $diff($r->pr_submitted_at, $r->po_approved_at),
            'tat_pr_to_release'  => $diff($r->pr_submitted_at, $r->po_released_at),
            'tat_pr_to_delivery' => $diff($r->pr_submitted_at, $r->po_delivered_at),
            'tat_pr_to_invoice'  => $diff($r->pr_submitted_at, $r->invoice_approved_at),
            'tat_po_to_approval' => $diff($r->po_created_at, $r->po_approved_at),
            'tat_po_to_release'  => $diff($r->po_created_at, $r->po_released_at),
        ];
    }

    private function exportCsv(\Illuminate\Support\Collection $rows): Response
    {
        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="tat-report-' . now()->format('Ymd-His') . '.csv"',
        ];

        $columns = [
            'PO Number', 'Status', 'Vendor', 'Cost Center', 'PR Number', 'PR Title', 'Amount (₹)',
            'PO Created', 'PO Approved', 'PO Released', 'PO Delivered', 'Invoice Approved',
            'TAT PR→PO (d)', 'TAT PR→Approval (d)', 'TAT PR→Release (d)',
            'TAT PR→Delivery (d)', 'TAT PR→Invoice (d)',
            'TAT PO→Approval (d)', 'TAT PO→Release (d)',
        ];

        $callback = function () use ($rows, $columns) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $columns);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['po_number'], $row['po_status'], $row['vendor'], $row['cost_center'],
                    $row['pr_number'], $row['pr_title'], $row['grand_total'],
                    $row['po_created_at'], $row['po_approved_at'], $row['po_released_at'],
                    $row['po_delivered_at'], $row['invoice_approved_at'],
                    $row['tat_pr_to_po'], $row['tat_pr_to_approval'], $row['tat_pr_to_release'],
                    $row['tat_pr_to_delivery'], $row['tat_pr_to_invoice'],
                    $row['tat_po_to_approval'], $row['tat_po_to_release'],
                ]);
            }
            fclose($out);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function exportPdf(\Illuminate\Support\Collection $rows, $tenant): Response
    {
        $pdf = Pdf::loadView('pdf.tat-report', [
            'rows'   => $rows,
            'tenant' => $tenant,
            'date'   => now()->format('d M Y H:i'),
        ])->setPaper('a3', 'landscape');

        return $pdf->download('tat-report-' . now()->format('Ymd') . '.pdf');
    }
}
