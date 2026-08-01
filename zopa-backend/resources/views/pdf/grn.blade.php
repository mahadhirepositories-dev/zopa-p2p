<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: "DejaVu Sans", Arial, sans-serif;
  font-size: 10px;
  color: #374151;
  background: #fff;
  line-height: 1.45;
  margin: 1.2cm 1.3cm 1.2cm 1.3cm;
}

.repeat-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  text-align: right;
  font-size: 8px;
  font-weight: bold;
  color: #6b7280;
  padding: 2px 0;
  letter-spacing: 0.3px;
  border-bottom: 1px solid #d1d5db;
}

.b   { font-weight: bold; }
.ink { color: #1f2937; }
.mut { color: #6b7280; }
.r   { text-align: right; }
.c   { text-align: center; }

/* ── Main header ── */
.main-header { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
.main-header td { vertical-align: top; }
.org-name   { font-size: 16px; font-weight: bold; color: #111827; }
.grn-title  { font-size: 22px; font-weight: bold; color: #1f2937; text-align: right; }
.grn-number { font-size: 13px; font-weight: bold; color: #2563eb; text-align: right; }
.grn-date   { font-size: 9px; color: #6b7280; text-align: right; }

/* ── Divider ── */
.divider { border: none; border-top: 2px solid #1f2937; margin: 10px 0; }

/* ── Info grid ── */
.info-grid { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
.info-cell {
  width: 25%; border: 1px solid #e5e7eb;
  padding: 7px 10px; vertical-align: top;
}
.info-label {
  font-size: 7.5px; font-weight: bold; text-transform: uppercase;
  letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 3px;
}
.info-value { font-size: 10px; font-weight: bold; color: #111827; }

/* ── Section heading ── */
.sec-heading {
  font-size: 8px; font-weight: bold; text-transform: uppercase;
  letter-spacing: 1px; color: #6b7280;
  padding-bottom: 4px; margin-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

/* ── Items table ── */
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9px; }
.items-table thead tr { background: #f3f4f6; }
.items-table th {
  padding: 7px 8px; text-align: left;
  font-size: 7.5px; font-weight: bold; text-transform: uppercase;
  letter-spacing: 0.6px; color: #6b7280;
  border-bottom: 2px solid #1f2937;
}
.items-table th.r, .items-table td.r { text-align: right; }
.items-table th.c, .items-table td.c { text-align: center; }
.items-table tbody tr { border-bottom: 1px solid #f0f0f0; }
.items-table tbody tr:last-child { border-bottom: 2px solid #1f2937; }
.items-table td { padding: 8px 8px; vertical-align: top; }
.item-desc  { font-weight: bold; color: #111827; }
.item-code  { font-size: 8px; color: #9ca3af; margin-top: 2px; }

/* ── Qty badges ── */
.badge-received  { background: #eff6ff; color: #2563eb; }
.badge-accepted  { background: #f0fdf4; color: #15803d; }
.badge-rejected  { background: #fff1f2; color: #dc2626; }
.badge {
  display: inline-block; padding: 2px 7px;
  font-size: 8px; font-weight: bold; border-radius: 99px;
}

/* ── Remarks box ── */
.remarks-box {
  border: 1px solid #e5e7eb; border-left: 3px solid #2563eb;
  padding: 8px 12px; margin-bottom: 12px;
  font-size: 9px; color: #374151; background: #f8fafc;
}

/* ── Signature row ── */
.sig-table { width: 100%; border-collapse: collapse; margin-top: 28px; }
.sig-table td { width: 33%; padding: 0 10px; vertical-align: bottom; text-align: center; }
.sig-line { border-top: 1px solid #374151; padding-top: 4px; margin-top: 32px; font-size: 8px; color: #6b7280; }
</style>
</head>
<body>

{{-- Repeating page header --}}
<div class="repeat-header">
  GRN: {{ $grn->grn_number }} &nbsp;|&nbsp; PO: {{ optional($grn->purchaseOrder)->po_number }} &nbsp;|&nbsp; {{ \Carbon\Carbon::parse($grn->received_date)->format('d M Y') }}
</div>

{{-- ── Main Header ── --}}
<table class="main-header">
  <tr>
    <td style="width:60%;">
      @php $tenant = optional($grn->purchaseOrder)->tenant; @endphp
      <div class="org-name">{{ $tenant->name ?? 'Organisation' }}</div>
      @if($tenant && $tenant->gstin)
        <div class="mut" style="font-size:9px;margin-top:2px;">GSTIN: {{ $tenant->gstin }}</div>
      @endif
    </td>
    <td style="width:40%;">
      <div class="grn-title">GOODS RECEIPT NOTE</div>
      <div class="grn-number">{{ $grn->grn_number }}</div>
      <div class="grn-date">Received: {{ \Carbon\Carbon::parse($grn->received_date)->format('d M Y') }}</div>
    </td>
  </tr>
</table>

<hr class="divider">

{{-- ── Info Grid ── --}}
<table class="info-grid">
  <tr>
    <td class="info-cell">
      <div class="info-label">PO Number</div>
      <div class="info-value">{{ optional($grn->purchaseOrder)->po_number ?? '—' }}</div>
    </td>
    <td class="info-cell">
      <div class="info-label">Vendor / Supplier</div>
      <div class="info-value">{{ optional(optional($grn->purchaseOrder)->vendor)->name ?? '—' }}</div>
    </td>
    <td class="info-cell">
      <div class="info-label">DC Number</div>
      <div class="info-value">{{ $grn->dc_number ?? '—' }}</div>
      @if($grn->dc_date)
        <div class="mut" style="font-size:8px;">{{ \Carbon\Carbon::parse($grn->dc_date)->format('d M Y') }}</div>
      @endif
    </td>
    <td class="info-cell">
      <div class="info-label">Invoice Number</div>
      <div class="info-value">{{ $grn->invoice_number ?? '—' }}</div>
      @if($grn->invoice_date)
        <div class="mut" style="font-size:8px;">{{ \Carbon\Carbon::parse($grn->invoice_date)->format('d M Y') }}</div>
      @endif
    </td>
  </tr>
  <tr>
    <td class="info-cell">
      <div class="info-label">Received By</div>
      <div class="info-value">{{ optional($grn->receivedBy)->name ?? '—' }}</div>
    </td>
    <td class="info-cell">
      <div class="info-label">Status</div>
      <div class="info-value" style="text-transform:uppercase;font-size:9px;color:#15803d;">{{ $grn->status }}</div>
    </td>
    @php $po = $grn->purchaseOrder; @endphp
    <td class="info-cell">
      <div class="info-label">Ship To</div>
      <div class="info-value" style="font-size:9px;font-weight:normal;">
        {{ optional($po)->ship_to ?? optional(optional($po)->shipToLocation)->name ?? '—' }}
      </div>
    </td>
    <td class="info-cell">
      <div class="info-label">Delivery Date</div>
      <div class="info-value">{{ \Carbon\Carbon::parse($grn->received_date)->format('d M Y') }}</div>
    </td>
  </tr>
</table>

{{-- ── Remarks ── --}}
@if($grn->remarks)
<div class="remarks-box"><span class="b">Remarks:</span> {{ $grn->remarks }}</div>
@endif

{{-- ── Line Items ── --}}
<div class="sec-heading">Line Items</div>
<table class="items-table">
  <thead>
    <tr>
      <th style="width:32px;">#</th>
      <th>Description / Item</th>
      <th class="c" style="width:60px;">UOM</th>
      <th class="r" style="width:70px;">Ordered Qty</th>
      <th class="r" style="width:80px;">Received Qty</th>
      <th class="r" style="width:80px;">Accepted Qty</th>
      <th class="r" style="width:70px;">Rejected Qty</th>
      <th style="width:100px;">Remarks</th>
    </tr>
  </thead>
  <tbody>
    @foreach($grn->items as $i => $item)
    @php $poItem = $item->poItem; @endphp
    <tr>
      <td class="c mut">{{ $i + 1 }}</td>
      <td>
        <div class="item-desc">{{ optional($poItem)->description ?? '—' }}</div>
        @if(optional(optional($poItem)->product)->code)
          <div class="item-code">Code: {{ $poItem->product->code }}</div>
        @endif
        @if(optional(optional($poItem)->product)->hsn_code)
          <div class="item-code">HSN: {{ $poItem->product->hsn_code }}</div>
        @endif
      </td>
      <td class="c mut">{{ optional($poItem)->uom ?? 'Nos' }}</td>
      <td class="r">{{ number_format((float) optional($poItem)->qty, 3) }}</td>
      <td class="r">
        <span class="badge badge-received">{{ number_format((float) $item->received_qty, 3) }}</span>
      </td>
      <td class="r">
        <span class="badge badge-accepted">{{ number_format((float) $item->accepted_qty, 3) }}</span>
      </td>
      <td class="r">
        @if((float) $item->rejected_qty > 0)
          <span class="badge badge-rejected">{{ number_format((float) $item->rejected_qty, 3) }}</span>
        @else
          <span class="mut">—</span>
        @endif
      </td>
      <td class="mut" style="font-size:8.5px;">{{ $item->remarks ?? '—' }}</td>
    </tr>
    @endforeach
  </tbody>
</table>

{{-- ── Summary row ── --}}
@php
  $totalReceived = $grn->items->sum(fn($i) => (float) $i->received_qty);
  $totalAccepted = $grn->items->sum(fn($i) => (float) $i->accepted_qty);
  $totalRejected = $grn->items->sum(fn($i) => (float) $i->rejected_qty);
@endphp
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
  <tr>
    <td style="width:60%;"></td>
    <td style="width:40%;">
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <tr>
          <td style="padding:4px 8px;color:#6b7280;">Total Items</td>
          <td style="padding:4px 8px;text-align:right;font-weight:bold;">{{ $grn->items->count() }}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;color:#6b7280;">Total Received</td>
          <td style="padding:4px 8px;text-align:right;font-weight:bold;color:#2563eb;">{{ number_format($totalReceived, 3) }}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:4px 8px;color:#6b7280;">Total Accepted</td>
          <td style="padding:4px 8px;text-align:right;font-weight:bold;color:#15803d;">{{ number_format($totalAccepted, 3) }}</td>
        </tr>
        @if($totalRejected > 0)
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:4px 8px;color:#6b7280;">Total Rejected</td>
          <td style="padding:4px 8px;text-align:right;font-weight:bold;color:#dc2626;">{{ number_format($totalRejected, 3) }}</td>
        </tr>
        @endif
      </table>
    </td>
  </tr>
</table>

{{-- ── Signature Section ── --}}
<table class="sig-table">
  <tr>
    <td>
      <div class="sig-line">Store / Warehouse Incharge</div>
    </td>
    <td>
      <div class="sig-line">Quality / Inspection Officer</div>
    </td>
    <td>
      <div class="sig-line">Authorised Signatory</div>
    </td>
  </tr>
</table>

</body>
</html>
