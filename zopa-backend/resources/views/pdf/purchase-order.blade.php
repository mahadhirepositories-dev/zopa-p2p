<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
/*
 * ZOPA PO PDF — professional, DomPDF-safe layout.
 * Rules enforced:
 *  - NO height:100% on any element (causes full-page blank cells)
 *  - font-weight ONLY bold(700) / normal(400)  (600 breaks the Rs glyph)
 *  - NO emoji (DejaVu Sans has no emoji glyphs);  Rupee = &#8377;
 *  - Layout via tables/<td>, NOT flex/grid (unsupported by DomPDF)
 *  - Near-monochrome: charcoal ink + grays, one accent = charcoal; bordered tables
 *  - MARGINS: this dompdf build honours BODY margin (NOT @page) — set on body{}.
 *  - PAGINATION: long sections (Terms, Approval) are MULTI-ROW tables so dompdf
 *    breaks BETWEEN rows. A single-row table can't split (-> blank pages) and
 *    free block flow overflows the bottom margin — both were real bugs here.
 */
@page { margin: 1.5cm 1.3cm; }   /* kept as a hint; the body margin does the work */

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: DejaVu Sans, sans-serif;
  font-size: 9px;
  color: #374151;
  background: #fff;
  line-height: 1.45;
  margin: 1.5cm 1.3cm;   /* dompdf applies body margin on page 1 / sides every page */
}
.b   { font-weight: bold; }
.ink { color: #1f2937; }
.mut { color: #6b7280; }
.fnt { color: #9ca3af; }
.r   { text-align: right; }
.c   { text-align: center; }

/* ── Section box + label ──────────────────────────────── */
.sec   { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.cell  { border: 1px solid #cbd5e1; border-top: 2px solid #1f2937; padding: 8px 11px; vertical-align: top; }
.nobrk { page-break-inside: avoid; }
.sl {
  font-size: 7.5px; font-weight: bold;
  text-transform: uppercase; letter-spacing: 1px;
  color: #6b7280;
  padding-bottom: 4px; margin-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}

/* ── Status badge (monochrome) ────────────────────────── */
.badge {
  display: inline-block; padding: 2px 7px;
  font-size: 7px; font-weight: bold;
  letter-spacing: 1px; text-transform: uppercase;
  border: 1px solid #9ca3af; color: #1f2937; background: #f3f4f6;
}

/* ── Items table ──────────────────────────────────────── */
table.items { width: 100%; border-collapse: collapse; }
table.items thead { display: table-header-group; }      /* repeat header each page */
table.items th {
  background: #1f2937; color: #fff;
  font-size: 7.5px; font-weight: bold;
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 6px 6px; border: 1px solid #1f2937; text-align: left;
}
table.items th.r { text-align: right; }
table.items th.c { text-align: center; }
table.items td {
  padding: 5px 6px; font-size: 9px; color: #374151;
  border: 1px solid #d1d5db; vertical-align: top;
}
table.items tbody tr:nth-child(even) td { background: #f8f9fb; }

/* ── Totals ───────────────────────────────────────────── */
table.tot { width: 100%; border-collapse: collapse; }
table.tot td { padding: 5px 10px; font-size: 9px; border: 1px solid #d1d5db; }
table.tot .lbl   { color: #6b7280; border-right: none; }
table.tot .val   { text-align: right; font-weight: bold; color: #1f2937; border-left: none; }
table.tot .grand td { background: #1f2937; color: #fff; font-weight: bold; border-color: #1f2937; }

/* ── Approvals ────────────────────────────────────────── */
table.approv { width: 100%; border-collapse: collapse; }
table.approv th {
  background: #f3f4f6; color: #374151;
  font-size: 7.5px; font-weight: bold;
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 5px 8px; border: 1px solid #d1d5db; text-align: left;
}
table.approv td { padding: 5px 8px; border: 1px solid #d1d5db; font-size: 9px; vertical-align: top; }
.c-ok  { color: #166534; font-weight: bold; }
.c-no  { color: #991b1b; font-weight: bold; }
.c-ret { color: #92400e; font-weight: bold; }
.c-pnd { color: #6b7280; }
table.approv thead { display: table-header-group; }   /* repeat header when split */

/* ── Standalone section header — for long sections that MUST be able to
      break across pages (Terms, Approval Trail). NEVER wrap such sections in a
      single-row <table>: DomPDF can't split a <tr>, which yields blank pages. ── */
.sec-h {
  font-size: 8px; font-weight: bold;
  text-transform: uppercase; letter-spacing: 1px;
  color: #1f2937; padding-bottom: 4px; margin: 4px 0 7px;
  border-bottom: 1.5px solid #1f2937;
}
/* Long terms render as a MULTI-ROW table — DomPDF paginates by breaking BETWEEN
   rows (a single-row table can't split → blank pages; free-flowing blocks
   overflow the bottom margin). One <tr> per line is the reliable pattern. */
.terms-tbl { width: 100%; border-collapse: collapse; }
.terms-tbl td { border: none; font-size: 9px; color: #374151; line-height: 1.5; padding: 1px 2px; vertical-align: top; }
.terms-tbl td.sub { font-weight: bold; color: #1f2937; padding-top: 8px; padding-bottom: 2px; }

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

/* ── Platform (ZOPA) logo — audit box only ────────────── */
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

/* ── Status badge ─────────────────────────────────────── */
$statusLabel = strtoupper(str_replace('_', ' ', $po->status));

/* ── Audit timestamps ─────────────────────────────────── */
$createdAt   = $po->created_at  ? \Carbon\Carbon::parse($po->created_at)->format('d M Y, H:i')  : null;
$approvedAt  = $po->approved_at ? \Carbon\Carbon::parse($po->approved_at)->format('d M Y, H:i') : null;
$releasedAt  = $po->released_at ? \Carbon\Carbon::parse($po->released_at)->format('d M Y, H:i') : null;
$creatorRole = $po->created_by_role  ? ucwords(str_replace('_', ' ', $po->created_by_role))  : null;
$approverRole= $po->approved_by_role ? ucwords(str_replace('_', ' ', $po->approved_by_role)) : null;
$generatedAt = now()->format('d M Y, H:i');

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


{{-- ═══════════ HEADER ═══════════ --}}
<table style="width:100%; border-collapse:collapse; border-bottom:2px solid #1f2937; margin-bottom:10px;">
  <tr>
    <td style="width:52%; padding:0 8px 8px 0; vertical-align:bottom;">
      @if($tenantLd)
        <img src="{{ $tenantLd }}" alt="Logo" style="max-height:54px; max-width:200px;" />
        @if($po->tenant?->gstin)
          <div style="font-size:8px; color:#6b7280; margin-top:3px;">GSTIN: {{ $po->tenant->gstin }}</div>
        @endif
      @else
        <div style="font-size:16px; font-weight:bold; color:#1f2937;">
          {{ $po->tenant?->name ?? 'ZOPA Procurement' }}
        </div>
        @if($po->tenant?->gstin)
          <div style="font-size:8px; color:#6b7280; margin-top:2px;">GSTIN: {{ $po->tenant->gstin }}</div>
        @endif
      @endif
    </td>

    <td style="width:48%; padding:0 0 8px 8px; vertical-align:bottom; text-align:right;">
      <div style="font-size:21px; font-weight:bold; color:#1f2937; letter-spacing:2px;">PURCHASE ORDER</div>
      <div style="margin-top:5px;">
        <span style="font-size:8.5px; color:#374151;"><strong>PO No:</strong>&nbsp;{{ $po->po_number ?? 'DRAFT' }}</span>
        &nbsp;&nbsp;<span class="badge">{{ $statusLabel }}</span>
      </div>
      @if($po->po_date)
      <div style="font-size:8.5px; color:#6b7280; margin-top:3px;">
        <strong>Date:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_date)->format('d M Y') }}
        @if($po->po_valid_till)
          &nbsp;&nbsp;<strong>Valid Till:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_valid_till)->format('d M Y') }}
        @endif
      </div>
      @endif
      @if(!empty($po->pr_reference))
      <div style="font-size:8px; color:#9ca3af; margin-top:2px;"><strong>PR Ref:</strong>&nbsp;{{ $po->pr_reference }}</div>
      @endif
    </td>
  </tr>
</table>

{{-- ═══════════ VENDOR ═══════════ --}}
<table class="sec nobrk">
  <tr>
    <td class="cell" style="background:#fafafa;">
      <div class="sl">Vendor / Supplier</div>
      <div style="font-size:11.5px; font-weight:bold; color:#1f2937; margin-bottom:2px;">{{ $po->vendor?->name }}</div>
      @php $vgstin = $po->vendorAddress?->gstin ?? $po->vendor?->gstin; @endphp
      @if($vgstin)
        <div style="font-size:8.5px; color:#6b7280; margin-bottom:2px;">GSTIN: {{ $vgstin }}</div>
      @endif
      @if($po->vendorAddress)
        <div style="font-size:9px; color:#374151; line-height:1.6;">
          @if($po->vendorAddress->label)<strong>{{ $po->vendorAddress->label }}</strong>&nbsp;&mdash;&nbsp;@endif
          @if($po->vendorAddress->address){{ $po->vendorAddress->address }}@endif
          @if($po->vendorAddress->state), {{ $po->vendorAddress->state }}@if($po->vendorAddress->state_code) ({{ $po->vendorAddress->state_code }})@endif @endif
        </div>
      @endif
    </td>
  </tr>
</table>

{{-- ═══════════ BILL TO / SHIP TO ═══════════ --}}
<table class="sec nobrk">
  <tr>
    <td class="cell" style="width:50%;">
      <div class="sl">Bill To</div>
      @if($po->costCenter)
        <div style="font-size:10.5px; font-weight:bold; color:#1f2937; margin-bottom:2px;">{{ $po->costCenter->name }}</div>
        @if($po->costCenter->department)<div style="font-size:8.5px; color:#6b7280; line-height:1.55;">Dept: {{ $po->costCenter->department->name }}</div>@endif
        @if($po->costCenter->project)<div style="font-size:8.5px; color:#6b7280; line-height:1.55;">Project: {{ $po->costCenter->project->name }}</div>@endif
        @if($po->costCenter->location)<div style="font-size:8.5px; color:#6b7280; line-height:1.55;">Location: {{ $po->costCenter->location->name }}</div>@endif
      @endif
      @if($po->billToLocation)
        <div style="font-size:9px; color:#374151; margin-top:3px; line-height:1.55;">
          <strong>{{ $po->billToLocation->name }}</strong>
          @include('pdf.partials.location-address', ['loc' => $po->billToLocation])
        </div>
      @endif
      @if(!$po->costCenter && !$po->billToLocation)
        <div style="font-size:9.5px; color:#1f2937;">{{ $po->tenant?->name }}</div>
      @endif
    </td>

    <td style="width:8px; border:none;"></td>

    <td class="cell" style="width:50%;">
      <div class="sl">Ship To</div>
      @if($po->shipToLocation)
        <div style="font-size:10.5px; font-weight:bold; color:#1f2937; margin-bottom:2px;">{{ $po->shipToLocation->name }}</div>
        <div style="font-size:9px; color:#374151; line-height:1.55;">
          @include('pdf.partials.location-address', ['loc' => $po->shipToLocation])
        </div>
      @elseif($po->billToLocation)
        <div style="font-size:9px; color:#6b7280; font-style:italic;">Same as Bill To</div>
      @endif
    </td>
  </tr>
</table>

{{-- ═══════════ LINE ITEMS ═══════════ --}}
<table class="items" style="margin-bottom:8px;">
  <thead>
    <tr>
      <th style="width:22px;" class="c">Sl<br>No</th>
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
      <td class="c fnt" style="font-size:8px;">{{ $item->sno }}</td>
      @if($hasCode)<td style="font-size:8px; color:#6b7280;">{{ $item->product?->code ?? '—' }}</td>@endif
      <td>
        <div style="font-weight:bold; color:#1f2937; font-size:9.5px; white-space:pre-wrap;">{{ $item->description }}</div>
        @if($item->product && $item->product->name !== $item->description)
          <div style="font-size:7.5px; color:#6b7280; margin-top:2px;">Product: {{ $item->product->name }}</div>
        @endif
        @if(!$hasCode && $item->product?->code && $item->product->code !== $item->description)
          <div style="font-size:7.5px; color:#9ca3af; margin-top:1px;">{{ $item->product->code }}</div>
        @endif
        @if(!$hasHSN && $item->product?->hsn_code)
          <div style="font-size:7.5px; color:#9ca3af; margin-top:1px;">HSN: {{ $item->product->hsn_code }}</div>
        @endif
      </td>
      @if($hasHSN)<td class="c" style="font-size:8.5px; color:#475569;">{{ $item->product?->hsn_code ?? '—' }}</td>@endif
      @if($hasUOM)<td class="c" style="font-size:9px;">{{ $item->product?->unit ?? '—' }}</td>@endif
      <td class="r" style="font-size:9px;">{{ rtrim(rtrim(number_format($item->qty, 3),'0'),'.') }}</td>
      <td class="r" style="font-size:9px;">&#8377;{{ number_format($item->net_rate, 2) }}</td>
      <td class="r" style="font-size:9px; color:#475569;">
        {{ number_format($item->gst_rate, 0) }}%
        @if($lineGst > 0)<br><span style="font-size:7.5px;">(&#8377;{{ number_format($lineGst, 2) }})</span>@endif
      </td>
      <td class="r b" style="font-size:9.5px; color:#1f2937;">&#8377;{{ number_format($lineTotal, 2) }}</td>
      @if($hasWar)<td class="c" style="font-size:9px; color:#475569;">{{ ($item->warranty_months ?? 0) > 0 ? $item->warranty_months.' mo' : '—' }}</td>@endif
      @if($hasRB)<td style="font-size:8.5px; color:#475569;">{{ $item->required_by ? \Carbon\Carbon::parse($item->required_by)->format('d M Y') : '—' }}</td>@endif
    </tr>
    @endforeach

    @if($po->freight > 0)
    <tr>
      <td class="c fnt" style="font-size:8px;">—</td>
      @if($hasCode)<td></td>@endif
      <td style="font-size:9px; color:#475569; font-style:italic;">Freight / Transportation</td>
      @if($hasHSN)<td></td>@endif
      @if($hasUOM)<td></td>@endif
      <td></td>
      <td class="r" style="font-size:9px;">&#8377;{{ number_format($po->freight, 2) }}</td>
      <td class="r fnt">—</td>
      <td class="r b" style="font-size:9.5px; color:#1f2937;">&#8377;{{ number_format($po->freight, 2) }}</td>
      @if($hasWar)<td></td>@endif
      @if($hasRB)<td></td>@endif
    </tr>
    @endif

    @if($po->round_off != 0)
    <tr>
      <td class="c fnt" style="font-size:8px;">—</td>
      @if($hasCode)<td></td>@endif
      <td style="font-size:9px; color:#475569; font-style:italic;">Round Off</td>
      @if($hasHSN)<td></td>@endif
      @if($hasUOM)<td></td>@endif
      <td></td>
      <td></td>
      <td></td>
      <td class="r" style="font-size:9.5px; color:#475569;">{{ $po->round_off > 0 ? '+' : '' }}&#8377;{{ number_format($po->round_off, 2) }}</td>
      @if($hasWar)<td></td>@endif
      @if($hasRB)<td></td>@endif
    </tr>
    @endif
  </tbody>
</table>

{{-- ═══════════ TOTALS + AMOUNT IN WORDS ═══════════ --}}
<table style="width:100%; border-collapse:collapse; margin-bottom:8px;" class="nobrk">
  <tr>
    <td style="width:54%; border:1px solid #d1d5db; background:#f8f9fb; padding:8px 11px; vertical-align:top;">
      <div class="sl">Amount in Words</div>
      <div style="font-size:9.5px; color:#1f2937; line-height:1.5;">{{ $amtWords }}</div>
    </td>
    <td style="width:8px; border:none;"></td>
    <td style="width:46%; padding:0; vertical-align:top;">
      <table class="tot">
        <tr>
          <td class="lbl">Net Total (before tax)</td>
          <td class="val">&#8377;{{ number_format($po->net_total, 2) }}</td>
        </tr>
        <tr>
          <td class="lbl">GST / Tax Amount</td>
          <td class="val">&#8377;{{ number_format($po->tax_amount, 2) }}</td>
        </tr>
        @if($po->freight > 0)
        <tr>
          <td class="lbl">Freight</td>
          <td class="val">&#8377;{{ number_format($po->freight, 2) }}</td>
        </tr>
        @endif
        <tr class="grand">
          <td style="text-transform:uppercase; letter-spacing:0.5px; font-size:8.5px;">Grand Total</td>
          <td style="text-align:right; font-size:12.5px;">&#8377;{{ number_format($po->grand_total, 2) }}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

{{-- ═══════════ TERMS & CONDITIONS ═══════════
     Rendered as flowing blocks (NOT a wrapping single-row table) so long
     free-text terms break across pages cleanly with no blank pages. --}}
@if(($po->payment_terms_json && count($po->payment_terms_json)) || $po->terms_conditions)
<div class="sec-h">Terms &amp; Conditions</div>
<table class="terms-tbl">
  @if($po->payment_terms_json && count($po->payment_terms_json))
    <tr><td class="sub">Payment Schedule</td></tr>
    @foreach($po->payment_terms_json as $idx => $pt)
      <tr><td>{{ $idx + 1 }}.&nbsp;{{ $pt['stage'] }} — {{ $pt['percentage'] }}%@if(!empty($pt['credit_days']) && $pt['credit_days'] > 0)&nbsp;({{ $pt['credit_days'] }} days credit)@endif</td></tr>
    @endforeach
  @endif
  @if($po->terms_conditions)
    @if($po->payment_terms_json && count($po->payment_terms_json))<tr><td class="sub">General Terms</td></tr>@endif
    @php $tcLines = array_values(array_filter(array_map('trim', preg_split('/\r?\n/', $po->terms_conditions)))); @endphp
    @foreach($tcLines as $line)
      {{-- Each line is its own row: preserve the buyer's own numbering / bullets (no auto-numbering). --}}
      <tr><td>{{ $line }}</td></tr>
    @endforeach
  @endif
</table>
<div style="margin-bottom:8px;"></div>
@endif

{{-- ═══════════ APPROVAL TRAIL (multilevel approvers + date & time) ═══════════ --}}
@if($po->approvals && $po->approvals->count())
<div class="sec-h">Approval Trail</div>
<table class="approv" style="margin-bottom:8px;">
        <thead>
          <tr>
            <th style="width:34px;" class="c">Level</th>
            <th>Approver</th>
            <th style="width:74px;">Decision</th>
            <th style="width:96px;">Date &amp; Time</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          @foreach($po->approvals as $a)
          <tr>
            <td class="c b ink">{{ $a->level }}</td>
            <td>{{ $a->assignedTo?->name ?? '—' }}</td>
            <td>
              @if($a->action==='approved')     <span class="c-ok">Approved</span>
              @elseif($a->action==='rejected') <span class="c-no">Rejected</span>
              @elseif($a->action==='returned') <span class="c-ret">Returned</span>
              @else                            <span class="c-pnd">Pending</span>
              @endif
            </td>
            <td style="color:#6b7280; font-size:8.5px;">
              {{ $a->acted_at ? \Carbon\Carbon::parse($a->acted_at)->format('d M Y, H:i') : '—' }}
            </td>
            <td style="font-size:9px; color:#475569; font-style:italic;">{{ $a->comments ?? '—' }}</td>
          </tr>
          @endforeach
        </tbody>
</table>
@endif

{{-- ═══════════ AUTHORISATION & AUDIT (replaces signatures) ═══════════ --}}
<table class="sec nobrk">
  <tr>
    <td class="cell">
      <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
        <tr>
          <td style="vertical-align:middle;"><div class="sl" style="border:none; margin:0; padding:0;">Authorisation &amp; Audit Trail</div></td>
          <td style="text-align:right; vertical-align:middle;">
            @if($platLd)<img src="{{ $platLd }}" alt="ZOPA" style="max-height:16px; max-width:60px;" />@endif
          </td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="width:50%; padding:3px 0; vertical-align:top;">
            <span class="mut" style="font-size:8px; text-transform:uppercase; letter-spacing:0.5px;">Prepared By</span><br>
            <span class="ink b" style="font-size:9.5px;">{{ $po->creator?->name ?? '—' }}</span>
            @if($creatorRole)<span class="mut" style="font-size:8px;">&nbsp;·&nbsp;{{ $creatorRole }}</span>@endif<br>
            <span class="mut" style="font-size:8.5px;">{{ $createdAt ? 'Created on '.$createdAt : '—' }}</span>
          </td>
          <td style="width:50%; padding:3px 0; vertical-align:top;">
            <span class="mut" style="font-size:8px; text-transform:uppercase; letter-spacing:0.5px;">Approved By</span><br>
            @if($po->approver?->name)
              <span class="ink b" style="font-size:9.5px;">{{ $po->approver->name }}</span>
              @if($approverRole)<span class="mut" style="font-size:8px;">&nbsp;·&nbsp;{{ $approverRole }}</span>@endif<br>
              <span class="mut" style="font-size:8.5px;">{{ $approvedAt ? 'Approved on '.$approvedAt : 'Approved' }}</span>
            @elseif(str_contains($po->status, 'approved') || in_array($po->status, ['released','delivered','invoiced','payment_released']))
              <span class="ink b" style="font-size:9.5px;">System Auto-Approved</span><br>
              <span class="mut" style="font-size:8.5px;">{{ $approvedAt ?? 'No approval level configured' }}</span>
            @else
              <span class="ink b" style="font-size:9.5px;">Pending Approval</span><br>
              <span class="mut" style="font-size:8.5px;">Status: {{ $statusLabel }}</span>
            @endif
            @if($releasedAt)<br><span class="mut" style="font-size:8px;">Released on {{ $releasedAt }}</span>@endif
          </td>
        </tr>
      </table>

      <div style="border-top:1px solid #e5e7eb; margin-top:7px; padding-top:6px; font-size:8.5px; color:#6b7280; font-style:italic;">
        This is a system-generated document. Generated on {{ $generatedAt }}. No signature required.
        @if($po->approvals && $po->approvals->count() > 1)&nbsp;Multi-level approvals are recorded in the Approval Trail above.@endif
      </div>
    </td>
  </tr>
</table>

</body>
</html>
