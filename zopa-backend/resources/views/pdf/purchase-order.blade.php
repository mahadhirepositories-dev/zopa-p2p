<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
/*
 * ZOPA PO PDF — DomPDF-safe layout (beautified)
 * Rules:
 *  - NO height:100% on any element
 *  - NO font-weight:600  (breaks Rs glyph in DejaVu Sans)
 *  - NO emoji (U+1Fxxx)
 *  - position:fixed for repeating page header/footer
 *  - Only font-weight:bold (700) or normal (400)
 */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: DejaVu Sans, sans-serif;
  font-size: 9px;
  color: #1e293b;
  background: #fff;
  line-height: 1.5;
  margin-top: 90px;
}

/* ── Repeating page header (DomPDF position:fixed trick) ── */
#page-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 82px;
  background: #fff;
  border-bottom: 3px solid #1565c0;
  padding: 0;
}
#page-header table { width: 100%; border-collapse: collapse; height: 82px; }
#page-header .hd-left { padding: 10px 16px; vertical-align: middle; width: 50%; }
#page-header .hd-right { padding: 10px 16px; vertical-align: middle; text-align: right; width: 50%; }
.po-title { font-size: 20px; font-weight: bold; color: #1565c0; letter-spacing: 1.5px; }
.po-meta  { font-size: 8.5px; color: #475569; margin-top: 4px; line-height: 1.8; }
.po-meta strong { color: #1e293b; }

/* ── Repeating page footer ────────────────────────────── */
#page-footer {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 20px;
  border-top: 1px solid #e2e8f0;
}
#page-footer table { width: 100%; border-collapse: collapse; }
#page-footer td { padding: 3px 8px; font-size: 7px; color: #94a3b8; vertical-align: middle; }

/* ── Status badge ─────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 7px; font-weight: bold;
  letter-spacing: 1px; text-transform: uppercase;
  border-radius: 3px;
}
.b-draft    { background:#e2e8f0; color:#475569; }
.b-pending  { background:#fef3c7; color:#92400e; }
.b-approved { background:#d1fae5; color:#065f46; }
.b-released { background:#dbeafe; color:#1e40af; }
.b-rejected { background:#fee2e2; color:#991b1b; }

/* ── Section label ──────────────────────────────────── */
.sl {
  font-size: 7px; font-weight: bold;
  text-transform: uppercase; letter-spacing: 1px;
  color: #1565c0;
  padding-bottom: 4px; margin-bottom: 6px;
  border-bottom: 1.5px solid #bbdefb;
}

/* ── Info card boxes ────────────────────────────────── */
.card {
  border: 1px solid #e2e8f0;
  border-top: 2.5px solid #1565c0;
  padding: 10px 13px;
  background: #fafafa;
}
.card-title { font-size: 12px; font-weight: bold; color: #1e293b; margin-bottom: 3px; }
.card-sub   { font-size: 8.5px; color: #64748b; line-height: 1.7; }

/* ── GSTIN chip ─────────────────────────────────────── */
.gstin {
  display: inline-block;
  background: #eff6ff; border: 1px solid #bfdbfe;
  border-radius: 3px; padding: 1px 6px;
  font-size: 7.5px; color: #1d4ed8;
  margin-top: 3px;
}

/* ── Items table ────────────────────────────────────── */
table.items { width:100%; border-collapse:collapse; }
table.items thead tr { background:#1e3a5f; }
table.items th {
  color:#fff; font-size:7.5px; font-weight:bold;
  text-transform:uppercase; letter-spacing:0.5px;
  padding:6px 6px; border:1px solid #1e3a5f;
  text-align:left;
}
table.items th.r { text-align:right; }
table.items th.c { text-align:center; }
table.items td {
  padding:6px 6px; font-size:9px; color:#334155;
  border:1px solid #e2e8f0; vertical-align:top;
}
table.items tbody tr:nth-child(even) td { background:#f8faff; }

/* ── Approvals table ────────────────────────────────── */
table.approv { width:100%; border-collapse:collapse; }
table.approv th {
  background:#f0f7ff; color:#475569;
  font-size:7.5px; text-transform:uppercase; letter-spacing:0.5px;
  padding:5px 7px; border:1px solid #dbeafe; text-align:left;
}
table.approv td { padding:6px 7px; border:1px solid #e2e8f0; font-size:9px; vertical-align:top; }
.c-ok  { color:#15803d; font-weight:bold; }
.c-no  { color:#b91c1c; font-weight:bold; }
.c-ret { color:#b45309; font-weight:bold; }
.c-pnd { color:#94a3b8; }

/* ── Totals summary block ───────────────────────────── */
.totals-row td {
  padding: 5px 10px;
  border-bottom: 1px solid #f0f4ff;
  font-size: 9px;
}
.totals-label { color: #64748b; }
.totals-value { text-align: right; font-weight: bold; color: #1e293b; }
.totals-grand-label {
  padding: 8px 10px;
  background: #1e3a5f;
  font-size: 8.5px; font-weight: bold;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: #bfdbfe;
}
.totals-grand-value {
  padding: 8px 10px;
  background: #1e3a5f;
  text-align: right;
  font-weight: bold; color: #fff; font-size: 13px;
}

</style>
</head>
<body>

@php
/* ── Client (tenant) logo ──────────────────────────────── */
$tenantLp = $po->tenant?->logo_path
  ? storage_path('app/public/' . $po->tenant->logo_path)
  : null;
$tenantLd = ($tenantLp && file_exists($tenantLp))
  ? 'data:' . mime_content_type($tenantLp) . ';base64,' . base64_encode(file_get_contents($tenantLp))
  : null;

/* ── Platform (ZOPA) logo — footer only ───────────────── */
$platSettings     = [];
$platSettingsFile = storage_path('app/public/platform/settings.json');
if (file_exists($platSettingsFile)) {
  $platSettings = json_decode(file_get_contents($platSettingsFile), true) ?? [];
}
$platLp = !empty($platSettings['logo_path'])
  ? storage_path('app/public/' . $platSettings['logo_path'])
  : null;
$platLd = ($platLp && file_exists($platLp))
  ? 'data:' . mime_content_type($platLp) . ';base64,' . base64_encode(file_get_contents($platLp))
  : null;

/* ── Status badge class ───────────────────────────────── */
$bc = match(true) {
  $po->status === 'approved'          => 'b-approved',
  $po->status === 'released'          => 'b-released',
  $po->status === 'rejected'          => 'b-rejected',
  str_contains($po->status, 'pending')=> 'b-pending',
  default                             => 'b-draft',
};

/* ── Amount in words (Indian numbering) ───────────────── */
if (!function_exists('_poNumWords')) {
  function _poNumWords(int $n): string {
    if ($n === 0) return 'Zero';
    $ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
             'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen',
             'Eighteen','Nineteen'];
    $tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    $w = '';
    foreach ([[10000000,'Crore'],[100000,'Lakh'],[1000,'Thousand'],[100,'Hundred']] as [$d,$name]) {
      if ($n >= $d) { $w .= _poNumWords((int)($n/$d)).' '.$name.' '; $n %= $d; }
    }
    if ($n >= 20) { $w .= $tens[(int)($n/10)].' '; $n %= 10; }
    if ($n > 0)   { $w .= $ones[$n].' '; }
    return trim($w);
  }
}
$amtWords = _poNumWords((int) round($po->grand_total)) . ' Rupees Only';

/* ── Item-level flags for optional columns ────────────── */
$hasCode = $po->items->contains(fn($i) => !empty($i->product?->code));
$hasHSN  = $po->items->contains(fn($i) => !empty($i->product?->hsn_code));
$hasUOM  = $po->items->contains(fn($i) => !empty($i->product?->unit));
$hasWar  = $po->items->contains(fn($i) => ($i->warranty_months ?? 0) > 0);
$hasRB   = $po->items->contains(fn($i) => !empty($i->required_by));

$poNo = $po->po_number ?? 'DRAFT';
$tenantGstin = $po->tenant?->gstin ?? '';
$vendorGstin = $po->vendorAddress?->gstin ?? $po->vendor?->gstin ?? '';
@endphp

{{-- ═══════════════════════════════════════════════════
     REPEATING PAGE HEADER — fixed, shows on every page
     ═══════════════════════════════════════════════════ --}}
<div id="page-header">
  <table>
    <tr>
      {{-- Left: tenant logo or company name --}}
      <td class="hd-left">
        @if($tenantLd)
          <img src="{{ $tenantLd }}" alt="Logo"
               style="max-height:52px; max-width:180px; object-fit:contain;" />
          @if($tenantGstin)
            <div style="font-size:7.5px; color:#64748b; margin-top:2px;">GSTIN: {{ $tenantGstin }}</div>
          @endif
        @else
          <div style="font-size:16px; font-weight:bold; color:#1e293b;">
            {{ $po->tenant?->name ?? 'ZOPA Procurement' }}
          </div>
          @if($tenantGstin)
            <div style="font-size:8px; color:#64748b; margin-top:2px;">GSTIN: {{ $tenantGstin }}</div>
          @endif
        @endif
      </td>

      {{-- Right: PURCHASE ORDER + PO No + meta --}}
      <td class="hd-right">
        <div class="po-title">PURCHASE ORDER</div>
        <div class="po-meta">
          <strong>PO No:</strong>&nbsp;{{ $poNo }}
          &nbsp;&nbsp;<span class="badge {{ $bc }}">{{ strtoupper(str_replace('_',' ',$po->status)) }}</span>
          @if($po->po_date)
            <br><strong>Date:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_date)->format('d M Y') }}
            @if($po->po_valid_till)
              &nbsp;&nbsp;<strong>Valid Till:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_valid_till)->format('d M Y') }}
            @endif
          @endif
          @if(!empty($po->pr_reference))
            <br><strong>PR Ref:</strong>&nbsp;{{ $po->pr_reference }}
          @endif
        </div>
      </td>
    </tr>
  </table>
</div>

{{-- ═══════════════════════════════════════════════════
     REPEATING PAGE FOOTER
     ═══════════════════════════════════════════════════ --}}
<div id="page-footer">
  <table>
    <tr>
      <td>
        Generated {{ now()->format('d M Y, H:i') }}
        &nbsp;&middot;&nbsp;
        @if($platLd)
          <img src="{{ $platLd }}" alt="ZOPA"
               style="max-height:12px; max-width:40px; vertical-align:middle; margin:0 2px;" />
        @else
          <span style="color:#1565c0; font-weight:bold;">ZOPA</span>
        @endif
        Procurement Platform
      </td>
      <td style="text-align:right;">
        <strong style="color:#475569;">{{ $po->tenant?->name }}</strong>
        &nbsp;&middot;&nbsp;PO:&nbsp;{{ $poNo }}
      </td>
    </tr>
  </table>
</div>

{{-- ═══════════════════════════════════════════════════
     VENDOR CARD
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
  <tr>
    <td class="card">
      <div class="sl">Vendor / Supplier</div>
      <div class="card-title">{{ $po->vendor?->name }}</div>
      @if($vendorGstin)
        <div><span class="gstin">GSTIN: {{ $vendorGstin }}</span></div>
      @endif
      @if($po->vendorAddress)
        <div class="card-sub" style="margin-top:5px;">
          @if($po->vendorAddress->label)
            <strong>{{ $po->vendorAddress->label }}</strong>&nbsp;&mdash;&nbsp;
          @endif
          @if($po->vendorAddress->address){{ $po->vendorAddress->address }}@endif
          @if($po->vendorAddress->state)
            , {{ $po->vendorAddress->state }}
            @if($po->vendorAddress->state_code) ({{ $po->vendorAddress->state_code }})@endif
          @endif
        </div>
      @endif
    </td>
  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     BILL TO  /  SHIP TO  (side by side)
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
  <tr>

    {{-- Bill To --}}
    <td style="width:49%; padding:0; vertical-align:top;">
      <div class="card" style="height:100%;">
        <div class="sl">Bill To</div>
        @if($po->billToLocation)
          <div class="card-title">{{ $po->billToLocation->name }}</div>
          @if($po->billToLocation->address)
            <div class="card-sub">{{ $po->billToLocation->address }}</div>
          @endif
          @if(!empty($po->billToLocation->gstin))
            <div><span class="gstin">GSTIN: {{ $po->billToLocation->gstin }}</span></div>
          @endif
        @elseif($po->costCenter)
          <div class="card-title">{{ $po->costCenter->name }}</div>
          @if($po->costCenter->department)
            <div class="card-sub">Dept: {{ $po->costCenter->department->name }}</div>
          @endif
          @if($po->costCenter->project)
            <div class="card-sub">Project: {{ $po->costCenter->project->name }}</div>
          @endif
          @if($po->costCenter->location)
            <div class="card-sub">Location: {{ $po->costCenter->location->name }}</div>
          @endif
        @else
          <div class="card-title">{{ $po->tenant?->name }}</div>
        @endif
        @if($tenantGstin)
          <div><span class="gstin">GSTIN: {{ $tenantGstin }}</span></div>
        @endif
      </div>
    </td>

    <td style="width:2%;"></td>

    {{-- Ship To --}}
    <td style="width:49%; padding:0; vertical-align:top;">
      <div class="card" style="height:100%;">
        <div class="sl">Ship To</div>
        @if($po->shipToLocation)
          <div class="card-title">{{ $po->shipToLocation->name }}</div>
          @if($po->shipToLocation->address)
            <div class="card-sub">{{ $po->shipToLocation->address }}</div>
          @endif
        @elseif($po->billToLocation)
          <div class="card-sub" style="font-style:italic; color:#94a3b8;">Same as Bill To</div>
        @else
          <div class="card-sub" style="font-style:italic; color:#94a3b8;">—</div>
        @endif
      </div>
    </td>

  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     LINE ITEMS TABLE
     ═══════════════════════════════════════════════════ --}}
<table class="items" style="margin-bottom:0; border-bottom:none;">
  <thead>
    <tr>
      <th style="width:22px; text-align:center;">Sl<br>No</th>
      @if($hasCode)<th style="width:52px;">Code</th>@endif
      <th>Description / Specification</th>
      @if($hasHSN)<th style="width:50px;" class="c">HSN</th>@endif
      @if($hasUOM)<th style="width:36px;" class="c">UOM</th>@endif
      <th style="width:34px;" class="r">Qty</th>
      <th style="width:74px;" class="r">Unit Price</th>
      <th style="width:88px;" class="r">GST</th>
      <th style="width:84px;" class="r">Amount</th>
      @if($hasWar)<th style="width:48px;" class="c">Warranty</th>@endif
      @if($hasRB)<th style="width:62px;">Req. By</th>@endif
    </tr>
  </thead>
  <tbody>
    @foreach($po->items as $item)
    @php
      $lineGst   = ($item->amount ?? 0) * ($item->gst_rate ?? 0) / 100;
      $lineTotal = ($item->amount ?? 0) + $lineGst;
    @endphp
    <tr>
      <td style="text-align:center; color:#94a3b8; font-size:8px;">{{ $item->sno }}</td>
      @if($hasCode)
        <td style="font-size:8px; color:#64748b;">{{ $item->product?->code ?? '—' }}</td>
      @endif
      <td>
        <div style="font-weight:bold; color:#1e293b; font-size:9.5px; white-space:pre-wrap;">{{ $item->description }}</div>
        @if($item->product && $item->product->name !== $item->description)
          <div style="font-size:7.5px; color:#64748b; margin-top:2px;">Product: {{ $item->product->name }}</div>
        @endif
        @if(!$hasCode && $item->product?->code && $item->product->code !== $item->description)
          <div style="font-size:7.5px; color:#94a3b8; margin-top:1px;">{{ $item->product->code }}</div>
        @endif
        @if(!$hasHSN && $item->product?->hsn_code)
          <div style="font-size:7.5px; color:#94a3b8; margin-top:1px;">HSN: {{ $item->product->hsn_code }}</div>
        @endif
      </td>
      @if($hasHSN)
        <td style="text-align:center; font-size:8.5px; color:#475569;">{{ $item->product?->hsn_code ?? '—' }}</td>
      @endif
      @if($hasUOM)
        <td style="text-align:center; font-size:9px;">{{ $item->product?->unit ?? '—' }}</td>
      @endif
      <td style="text-align:right; font-size:9px;">{{ rtrim(rtrim(number_format($item->qty, 3),'0'),'.') }}</td>
      <td style="text-align:right; font-size:9px;">&#8377;{{ number_format($item->net_rate, 2) }}</td>
      <td style="text-align:right; font-size:9px; color:#475569;">
        {{ number_format($item->gst_rate, 0) }}%
        @if($lineGst > 0)
          <br><span style="font-size:7.5px;">(&#8377;{{ number_format($lineGst, 2) }})</span>
        @endif
      </td>
      <td style="text-align:right; font-weight:bold; font-size:9.5px;">&#8377;{{ number_format($lineTotal, 2) }}</td>
      @if($hasWar)
        <td style="text-align:center; font-size:9px; color:#475569;">
          {{ ($item->warranty_months ?? 0) > 0 ? $item->warranty_months.' mo' : '—' }}
        </td>
      @endif
      @if($hasRB)
        <td style="font-size:8.5px; color:#475569;">
          {{ $item->required_by ? \Carbon\Carbon::parse($item->required_by)->format('d M Y') : '—' }}
        </td>
      @endif
    </tr>
    @endforeach

    {{-- Freight row --}}
    @if($po->freight > 0)
    <tr>
      <td style="text-align:center; color:#94a3b8; font-size:8px;">—</td>
      @if($hasCode)<td style="font-size:8px;"></td>@endif
      <td style="font-size:9px; color:#475569; font-style:italic;">Freight / Transportation</td>
      @if($hasHSN)<td></td>@endif
      @if($hasUOM)<td></td>@endif
      <td></td>
      <td style="text-align:right; font-size:9px;">&#8377;{{ number_format($po->freight, 2) }}</td>
      <td style="text-align:right; font-size:9px; color:#94a3b8;">—</td>
      <td style="text-align:right; font-weight:bold; font-size:9.5px;">&#8377;{{ number_format($po->freight, 2) }}</td>
      @if($hasWar)<td></td>@endif
      @if($hasRB)<td></td>@endif
    </tr>
    @endif

    {{-- Round-off row --}}
    @if($po->round_off != 0)
    <tr>
      <td style="text-align:center; color:#94a3b8; font-size:8px;">—</td>
      @if($hasCode)<td></td>@endif
      <td style="font-size:9px; color:#475569; font-style:italic;">Round Off</td>
      @if($hasHSN)<td></td>@endif
      @if($hasUOM)<td></td>@endif
      <td></td><td></td><td></td>
      <td style="text-align:right; font-size:9.5px; color:#475569;">
        {{ $po->round_off > 0 ? '+' : '' }}&#8377;{{ number_format($po->round_off, 2) }}
      </td>
      @if($hasWar)<td></td>@endif
      @if($hasRB)<td></td>@endif
    </tr>
    @endif
  </tbody>
</table>

{{-- ── Financial totals (right-aligned summary below items) ── --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:0;">
  <tr>
    <td style="width:55%; border:none; padding:0;"></td>
    <td style="width:45%; border:1px solid #e2e8f0; border-top:none; padding:0; vertical-align:top;">
      <table style="width:100%; border-collapse:collapse;">
        <tr class="totals-row">
          <td class="totals-label">Net Total (before tax)</td>
          <td class="totals-value">&#8377;{{ number_format($po->net_total, 2) }}</td>
        </tr>
        @if($po->freight > 0)
        <tr class="totals-row">
          <td class="totals-label">Freight</td>
          <td class="totals-value">&#8377;{{ number_format($po->freight, 2) }}</td>
        </tr>
        @endif
        <tr class="totals-row">
          <td class="totals-label">GST / Tax Amount</td>
          <td class="totals-value">&#8377;{{ number_format($po->tax_amount, 2) }}</td>
        </tr>
        <tr>
          <td class="totals-grand-label">Grand Total</td>
          <td class="totals-grand-value">&#8377;{{ number_format($po->grand_total, 2) }}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

{{-- ── Amount in words ───────────────────────────────────── --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
  <tr>
    <td style="border:1px solid #e2e8f0; border-top:none; background:#f8faff;
               padding:7px 11px; font-size:9px; color:#334155; font-style:italic;">
      <strong style="font-style:normal; color:#1e293b;">Amount in Words:</strong>
      &nbsp;{{ $amtWords }}
    </td>
  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     TERMS & CONDITIONS
     ═══════════════════════════════════════════════════ --}}
@if(($po->payment_terms_json && count($po->payment_terms_json)) || $po->terms_conditions)
<table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
  <tr>
    <td class="card" style="background:#fff;">
      <div class="sl">Terms &amp; Conditions</div>

      @if($po->payment_terms_json && count($po->payment_terms_json))
        <div style="font-size:9px; font-weight:bold; color:#1e293b; margin-bottom:5px;">
          Payment Schedule
        </div>
        @foreach($po->payment_terms_json as $idx => $pt)
          <div style="font-size:9px; color:#334155; line-height:1.8; padding-left:12px;">
            {{ $idx + 1 }}.&nbsp;{{ $pt['stage'] }} — {{ $pt['percentage'] }}%
            @if(!empty($pt['credit_days']) && $pt['credit_days'] > 0)
              ({{ $pt['credit_days'] }} days credit)
            @endif
          </div>
        @endforeach
        @if($po->terms_conditions)<div style="margin-top:8px;"></div>@endif
      @endif

      @if($po->terms_conditions)
        @php
          $tcLines = array_values(array_filter(
            array_map('trim', preg_split('/\r?\n/', $po->terms_conditions))
          ));
          $isSpecial = $po->payment_terms_json && count($po->payment_terms_json);
        @endphp
        <div style="font-size:9px; font-weight:bold; color:#1e293b; margin-bottom:5px;">
          {{ $isSpecial ? 'General Terms' : 'Payment Terms' }}
        </div>
        @foreach($tcLines as $i => $line)
          <div style="font-size:9px; color:#334155; line-height:1.8; padding-left:12px;">
            {{ $i + 1 }}.&nbsp;{{ $line }}
          </div>
        @endforeach
      @endif
    </td>
  </tr>
</table>
@endif

{{-- ═══════════════════════════════════════════════════
     APPROVAL HISTORY
     ═══════════════════════════════════════════════════ --}}
@if($po->approvals && $po->approvals->count())
<table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
  <tr>
    <td style="padding:0; border:1px solid #e2e8f0; border-top:2.5px solid #1565c0;">
      <div class="sl" style="padding:7px 13px 5px; margin-bottom:0;">Authorisation &amp; Audit Trail</div>
      <table class="approv">
        <thead>
          <tr>
            <th style="width:36px; text-align:center;">Level</th>
            <th>Approver</th>
            <th style="width:80px;">Status</th>
            <th style="width:74px;">Date</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          @foreach($po->approvals as $a)
          <tr>
            <td style="text-align:center; color:#1565c0; font-weight:bold;">{{ $a->level }}</td>
            <td>{{ $a->assignedTo?->name ?? '—' }}</td>
            <td>
              @if($a->action==='approved')     <span class="c-ok">Approved</span>
              @elseif($a->action==='rejected') <span class="c-no">Rejected</span>
              @elseif($a->action==='returned') <span class="c-ret">Returned</span>
              @else                            <span class="c-pnd">Pending</span>
              @endif
            </td>
            <td style="color:#64748b; font-size:8.5px;">
              {{ $a->acted_at ? \Carbon\Carbon::parse($a->acted_at)->format('d M Y') : '—' }}
            </td>
            <td style="font-size:9px; color:#475569; font-style:italic;">{{ $a->comments ?? '—' }}</td>
          </tr>
          @endforeach
        </tbody>
      </table>
    </td>
  </tr>
</table>
@endif

{{-- ═══════════════════════════════════════════════════
     SIGNATURE BLOCK
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; margin-top:18px; margin-bottom:28px;">
  <tr>
    {{-- Prepared By --}}
    <td style="width:48%; border:1px solid #e2e8f0; border-top:2.5px solid #1565c0;
               padding:10px 13px; vertical-align:bottom; background:#fafafa;">
      <div style="font-size:7px; font-weight:bold; text-transform:uppercase;
                  letter-spacing:1px; color:#1565c0; margin-bottom:3px;">Prepared By</div>
      @php
        $preparedBy = $po->approvals?->first()?->assignedTo?->name ?? null;
        $createdAt  = $po->created_at ? \Carbon\Carbon::parse($po->created_at)->format('d M Y, H:i') : null;
      @endphp
      @if($po->creator ?? null)
        <div style="font-size:9px; font-weight:bold; color:#1e293b;">{{ $po->creator->name }}</div>
        @if($po->creator->email ?? null)
          <div style="font-size:8px; color:#64748b;">{{ $po->creator->email }}</div>
        @endif
      @endif
      @if($createdAt)
        <div style="font-size:8px; color:#94a3b8; margin-top:2px;">Created on {{ $createdAt }}</div>
      @endif
      <div style="border-top:1px solid #cbd5e1; margin-top:26px; padding-top:4px;
                  font-size:7.5px; color:#94a3b8;">Signature &amp; Name</div>
    </td>

    <td style="width:4%;"></td>

    {{-- Approved By --}}
    <td style="width:48%; border:1px solid #e2e8f0; border-top:2.5px solid #1565c0;
               padding:10px 13px; vertical-align:bottom; background:#fafafa;">
      <div style="font-size:7px; font-weight:bold; text-transform:uppercase;
                  letter-spacing:1px; color:#1565c0; margin-bottom:3px;">Approved By</div>
      @php
        $lastApproval = $po->approvals?->where('action','approved')->sortByDesc('level')->first();
      @endphp
      @if($lastApproval)
        <div style="font-size:9px; font-weight:bold; color:#1e293b;">{{ $lastApproval->assignedTo?->name ?? '—' }}</div>
        @if($lastApproval->acted_at)
          <div style="font-size:8px; color:#64748b;">{{ \Carbon\Carbon::parse($lastApproval->acted_at)->format('d M Y, H:i') }}</div>
        @endif
      @else
        <div style="font-size:9px; color:#f59e0b; font-weight:bold;">Pending Approval</div>
        <div style="font-size:8px; color:#94a3b8;">Status: {{ strtoupper(str_replace('_',' ',$po->status)) }}</div>
      @endif
      <div style="border-top:1px solid #cbd5e1; margin-top:26px; padding-top:4px;
                  font-size:7.5px; color:#94a3b8;">Authorised Signatory</div>
    </td>
  </tr>
</table>

<div style="font-size:7px; color:#94a3b8; text-align:center; margin-top:4px;">
  System generated document. No signature required.
</div>

</body>
</html>
