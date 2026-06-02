<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
/*
 * ZOPA PO PDF — DomPDF-safe layout
 * Rules enforced:
 *  - NO height:100% on any element (causes full-page blank cells)
 *  - NO font-weight:600 (breaks Rs glyph in DejaVu Sans)
 *  - NO emoji (U+1Fxxx) — DejaVu Sans has no emoji glyphs
 *  - Layout via <td> inline styles, NOT wrapper divs
 *  - Only font-weight:bold (700) or normal (400)
 */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: DejaVu Sans, sans-serif;
  font-size: 9px;
  color: #1e293b;
  background: #fff;
  line-height: 1.45;
}

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
@endphp

{{-- ═══════════════════════════════════════════════════
     HEADER — client logo left | PO title right
     White background; blue bottom border
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; border-bottom:3px solid #1565c0; margin-bottom:10px;">
  <tr>

    {{-- Left: client company logo (or company name as fallback) --}}
    <td style="width:50%; padding:12px 16px; vertical-align:middle;">
      @if($tenantLd)
        <img src="{{ $tenantLd }}" alt="Logo"
             style="max-height:60px; max-width:200px; object-fit:contain;" />
      @else
        <div style="font-size:17px; font-weight:bold; color:#1e293b;">
          {{ $po->tenant?->name ?? 'ZOPA Procurement' }}
        </div>
        @if($po->tenant?->gstin)
          <div style="font-size:8px; color:#64748b; margin-top:2px;">
            GSTIN: {{ $po->tenant->gstin }}
          </div>
        @endif
      @endif
    </td>

    {{-- Right: PURCHASE ORDER title + key meta --}}
    <td style="width:50%; padding:12px 16px; vertical-align:middle; text-align:right;">
      <div style="font-size:22px; font-weight:bold; color:#1565c0; letter-spacing:1.5px;">
        PURCHASE ORDER
      </div>
      <table style="border-collapse:collapse; width:100%; margin-top:6px;">
        <tr>
          <td style="text-align:right; padding:1px 0;">
            <span style="font-size:8.5px; color:#475569;">
              <strong>PO No:</strong>&nbsp;{{ $po->po_number ?? 'DRAFT' }}
            </span>
            &nbsp;&nbsp;
            <span class="badge {{ $bc }}">{{ strtoupper(str_replace('_',' ',$po->status)) }}</span>
          </td>
        </tr>
        @if($po->po_date)
        <tr>
          <td style="text-align:right; padding:1px 0; font-size:8.5px; color:#64748b;">
            <strong>Date:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_date)->format('d M Y') }}
            @if($po->po_valid_till)
              &nbsp;&nbsp;<strong>Valid Till:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_valid_till)->format('d M Y') }}
            @endif
          </td>
        </tr>
        @endif
        @if(!empty($po->pr_reference))
        <tr>
          <td style="text-align:right; padding:1px 0; font-size:8px; color:#64748b;">
            <strong>PR Ref:</strong>&nbsp;{{ $po->pr_reference }}
          </td>
        </tr>
        @endif
      </table>
    </td>

  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     VENDOR
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
  <tr>
    <td style="border:1px solid #e2e8f0; border-top:2.5px solid #1565c0; padding:10px 13px; background:#fafafa;">
      <div class="sl">Vendor / Supplier</div>
      <div style="font-size:12px; font-weight:bold; color:#1e293b; margin-bottom:3px;">
        {{ $po->vendor?->name }}
      </div>
      @php
        $vgstin = $po->vendorAddress?->gstin ?? $po->vendor?->gstin;
      @endphp
      @if($vgstin)
        <div style="font-size:8.5px; color:#64748b; margin-bottom:3px;">GSTIN: {{ $vgstin }}</div>
      @endif
      @if($po->vendorAddress)
        <div style="font-size:9px; color:#475569; line-height:1.7;">
          @if($po->vendorAddress->label)
            <strong>{{ $po->vendorAddress->label }}</strong>&nbsp;—&nbsp;
          @endif
          @if($po->vendorAddress->address)
            {{ $po->vendorAddress->address }}
          @endif
          @if($po->vendorAddress->state)
            , {{ $po->vendorAddress->state }}
            @if($po->vendorAddress->state_code)
              ({{ $po->vendorAddress->state_code }})
            @endif
          @endif
        </div>
      @endif
    </td>
  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     BILL TO  /  SHIP TO
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
  <tr>

    {{-- Bill To --}}
    <td style="width:49%; border:1px solid #e2e8f0; border-top:2.5px solid #1565c0;
               padding:10px 13px; vertical-align:top;">
      <div class="sl">Bill To</div>
      @if($po->costCenter)
        <div style="font-size:11px; font-weight:bold; color:#1e293b; margin-bottom:3px;">
          {{ $po->costCenter->name }}
        </div>
        @if($po->costCenter->department)
          <div style="font-size:8.5px; color:#64748b; line-height:1.6;">
            Dept: {{ $po->costCenter->department->name }}
          </div>
        @endif
        @if($po->costCenter->project)
          <div style="font-size:8.5px; color:#64748b; line-height:1.6;">
            Project: {{ $po->costCenter->project->name }}
          </div>
        @endif
        @if($po->costCenter->location)
          <div style="font-size:8.5px; color:#64748b; line-height:1.6;">
            Location: {{ $po->costCenter->location->name }}
          </div>
        @endif
      @endif
      @if($po->billToLocation)
        <div style="font-size:9px; color:#475569; margin-top:4px; line-height:1.6;">
          <strong>{{ $po->billToLocation->name }}</strong>
          @include('pdf.partials.location-address', ['loc' => $po->billToLocation])
        </div>
      @endif
      @if(!$po->costCenter && !$po->billToLocation)
        <div style="font-size:9.5px; color:#1e293b;">{{ $po->tenant?->name }}</div>
      @endif
    </td>

    <td style="width:2%;"></td>

    {{-- Ship To --}}
    <td style="width:49%; border:1px solid #e2e8f0; border-top:2.5px solid #1565c0;
               padding:10px 13px; vertical-align:top;">
      <div class="sl">Ship To</div>
      @if($po->shipToLocation)
        <div style="font-size:11px; font-weight:bold; color:#1e293b; margin-bottom:3px;">
          {{ $po->shipToLocation->name }}
        </div>
        <div style="font-size:9px; color:#475569; line-height:1.6;">
          @include('pdf.partials.location-address', ['loc' => $po->shipToLocation])
        </div>
      @elseif($po->billToLocation)
        <div style="font-size:9px; color:#64748b; font-style:italic;">Same as Bill To</div>
      @endif
    </td>

  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     LINE ITEMS TABLE
     Columns: Sl | Code? | Description | HSN? | UOM? | Qty | Unit Price | GST | Amount
     ═══════════════════════════════════════════════════ --}}
<table class="items" style="margin-bottom:0; border-bottom:none;">
  <thead>
    <tr>
      <th style="width:22px; text-align:center;">Sl<br>No</th>
      @if($hasCode)
        <th style="width:52px;">Code</th>
      @endif
      <th>Description / Specification</th>
      @if($hasHSN)
        <th style="width:50px;" class="c">HSN</th>
      @endif
      @if($hasUOM)
        <th style="width:36px;" class="c">UOM</th>
      @endif
      <th style="width:34px;" class="r">Qty</th>
      <th style="width:74px;" class="r">Unit Price</th>
      <th style="width:88px;" class="r">GST</th>
      <th style="width:84px;" class="r">Amount</th>
      @if($hasWar)
        <th style="width:48px;" class="c">Warranty</th>
      @endif
      @if($hasRB)
        <th style="width:62px;">Req. By</th>
      @endif
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
        {{-- Primary: item specification / description typed by buyer --}}
        <div style="font-weight:bold; color:#1e293b; font-size:9.5px; white-space:pre-wrap;">{{ $item->description }}</div>
        {{-- If description differs from product name, show product name as sub-label --}}
        @if($item->product && $item->product->name !== $item->description)
          <div style="font-size:7.5px; color:#64748b; margin-top:2px;">
            Product: {{ $item->product->name }}
          </div>
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

    {{-- Freight row (if any) --}}
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

    {{-- Round-off row (if any) --}}
    @if($po->round_off != 0)
    <tr>
      <td style="text-align:center; color:#94a3b8; font-size:8px;">—</td>
      @if($hasCode)<td></td>@endif
      <td style="font-size:9px; color:#475569; font-style:italic;">Round Off</td>
      @if($hasHSN)<td></td>@endif
      @if($hasUOM)<td></td>@endif
      <td></td>
      <td></td>
      <td></td>
      <td style="text-align:right; font-size:9.5px; color:#475569;">
        {{ $po->round_off > 0 ? '+' : '' }}&#8377;{{ number_format($po->round_off, 2) }}
      </td>
      @if($hasWar)<td></td>@endif
      @if($hasRB)<td></td>@endif
    </tr>
    @endif

  </tbody>
</table>

{{-- ── Financial totals (right-aligned, below items table) ── --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:0;">
  <tr>

    {{-- Left: empty spacer --}}
    <td style="width:55%; border:none; padding:0;"></td>

    {{-- Right: summary block --}}
    <td style="width:45%; border:1px solid #e2e8f0; border-top:none; padding:0; vertical-align:top;">

      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="padding:5px 10px; border-bottom:1px solid #f0f4ff; font-size:9px; color:#64748b;">
            Net Total (before tax)
          </td>
          <td style="padding:5px 10px; border-bottom:1px solid #f0f4ff; text-align:right;
                     font-size:9px; font-weight:bold; color:#1e293b;">
            &#8377;{{ number_format($po->net_total, 2) }}
          </td>
        </tr>
        <tr>
          <td style="padding:5px 10px; border-bottom:1px solid #f0f4ff; font-size:9px; color:#64748b;">
            GST / Tax Amount
          </td>
          <td style="padding:5px 10px; border-bottom:1px solid #f0f4ff; text-align:right;
                     font-size:9px; font-weight:bold; color:#1e293b;">
            &#8377;{{ number_format($po->tax_amount, 2) }}
          </td>
        </tr>
        @if($po->freight > 0)
        <tr>
          <td style="padding:5px 10px; border-bottom:1px solid #f0f4ff; font-size:9px; color:#64748b;">
            Freight
          </td>
          <td style="padding:5px 10px; border-bottom:1px solid #f0f4ff; text-align:right;
                     font-size:9px; font-weight:bold; color:#1e293b;">
            &#8377;{{ number_format($po->freight, 2) }}
          </td>
        </tr>
        @endif
        <tr>
          <td style="padding:8px 10px; background:#1e3a5f;
                     font-size:8.5px; font-weight:bold; text-transform:uppercase;
                     letter-spacing:0.5px; color:#bfdbfe;">
            Grand Total
          </td>
          <td style="padding:8px 10px; background:#1e3a5f; text-align:right;
                     font-weight:bold; color:#fff; font-size:13px;">
            &#8377;{{ number_format($po->grand_total, 2) }}
          </td>
        </tr>
      </table>

    </td>

  </tr>
</table>

{{-- ── Amount in words ───────────────────────────────────── --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
  <tr>
    <td style="border:1px solid #e2e8f0; border-top:none; background:#f8faff;
               padding:6px 11px; font-size:9px; color:#334155; font-style:italic;">
      <strong style="font-style:normal;">Amount in Words:</strong>&nbsp;{{ $amtWords }}
    </td>
  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     TERMS & CONDITIONS
     ═══════════════════════════════════════════════════ --}}
@if(($po->payment_terms_json && count($po->payment_terms_json)) || $po->terms_conditions)
<table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
  <tr>
    <td style="border:1px solid #e2e8f0; border-top:2.5px solid #1565c0; padding:10px 13px;">
      <div class="sl">Terms &amp; Conditions</div>

      @if($po->payment_terms_json && count($po->payment_terms_json))
        <div style="font-size:9px; font-weight:bold; color:#1e293b; margin-bottom:4px;">
          Payment Terms:
        </div>
        @foreach($po->payment_terms_json as $idx => $pt)
          <div style="font-size:9px; color:#334155; line-height:1.7; padding-left:12px;">
            {{ $idx + 1 }}.&nbsp;{{ $pt['stage'] }} — {{ $pt['percentage'] }}%
            @if(!empty($pt['credit_days']) && $pt['credit_days'] > 0)
              ({{ $pt['credit_days'] }} days credit)
            @endif
          </div>
        @endforeach
        @if($po->terms_conditions)
          <div style="margin-top:8px;"></div>
        @endif
      @endif

      @if($po->terms_conditions)
        @if($po->payment_terms_json && count($po->payment_terms_json))
          <div style="font-size:9px; font-weight:bold; color:#1e293b; margin-bottom:4px;">
            Special Terms:
          </div>
        @else
          <div style="font-size:9px; font-weight:bold; color:#1e293b; margin-bottom:4px;">
            Payment Terms:
          </div>
        @endif
        @php
          $tcLines = array_values(array_filter(
            array_map('trim', preg_split('/\r?\n/', $po->terms_conditions))
          ));
        @endphp
        @foreach($tcLines as $i => $line)
          <div style="font-size:9px; color:#334155; line-height:1.7; padding-left:12px;">
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
      <div class="sl" style="padding:7px 13px 5px; margin-bottom:0;">Approval History</div>
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
            <td style="font-size:9px; color:#475569; font-style:italic;">
              {{ $a->comments ?? '—' }}
            </td>
          </tr>
          @endforeach
        </tbody>
      </table>
    </td>
  </tr>
</table>
@endif

{{-- ═══════════════════════════════════════════════════
     SIGNATURE / AUTHORISATION
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; margin-top:16px; margin-bottom:12px;">
  <tr>
    <td style="width:48%; border:1px solid #e2e8f0; padding:10px 13px; vertical-align:bottom;">
      <div style="font-size:8.5px; color:#64748b; margin-bottom:18px;">Prepared By</div>
      <div style="font-size:9.5px; color:#1e293b; font-weight:bold;">{{ $po->creator?->name ?? '—' }}</div>
      <div style="border-top:1px solid #475569; padding-top:4px; font-size:8px; color:#94a3b8;">
        Signature &amp; Date
      </div>
    </td>
    <td style="width:4%;"></td>
    <td style="width:48%; border:1px solid #e2e8f0; padding:10px 13px; vertical-align:bottom;">
      <div style="font-size:8.5px; color:#64748b; margin-bottom:18px;">PO Approved By</div>
      <div style="font-size:9.5px; color:#1e293b; font-weight:bold;">{{ $po->approver?->name ?? '—' }}</div>
      <div style="border-top:1px solid #475569; padding-top:4px; font-size:8px; color:#94a3b8;">
        Authorised Signatory
      </div>
    </td>
  </tr>
</table>

{{-- ═══════════════════════════════════════════════════
     FOOTER — ZOPA platform logo only (not in header)
     ═══════════════════════════════════════════════════ --}}
<table style="width:100%; border-collapse:collapse; border-top:1px solid #e2e8f0;">
  <tr>
    <td style="padding-top:6px; font-size:7.5px; color:#94a3b8; vertical-align:middle;">
      Generated {{ now()->format('d M Y, H:i') }}
      &nbsp;&middot;&nbsp;
      @if($platLd)
        <img src="{{ $platLd }}" alt="ZOPA"
             style="max-height:14px; max-width:50px; vertical-align:middle; margin:0 2px;" />
      @else
        <span style="color:#1565c0; font-weight:bold;">ZOPA</span>
      @endif
      Procurement Platform
    </td>
    <td style="padding-top:6px; font-size:7.5px; color:#94a3b8; text-align:right; vertical-align:middle;">
      <strong style="color:#475569;">{{ $po->tenant?->name }}</strong>
      @if($po->po_number)&nbsp;&middot;&nbsp;{{ $po->po_number }}@endif
    </td>
  </tr>
</table>

</body>
</html>
