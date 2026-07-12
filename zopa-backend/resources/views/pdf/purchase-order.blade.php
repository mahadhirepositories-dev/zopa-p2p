<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
/*
 * wkhtmltopdf 0.12.6 unpatched Qt — --header-html / --header-right do NOT work.
 * The ONLY reliable repeating-header technique: the <thead> of the items table
 * holds "PO No: X" as its first row. wkhtmltopdf repeats <thead> natively on
 * every page break. DomPDF also supports <thead> repetition.
 */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9px;
  color: #374151;
  background: #fff;
  line-height: 1.45;
}
@if(isset($is_dompdf) && $is_dompdf)
body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 10px; }
@endif

/* ── DomPDF fixed header (repeats on every page) ───────── */
@if(isset($is_dompdf) && $is_dompdf)
body { margin: 1.2cm 1.3cm 1.2cm 1.3cm; }
header {
  position: fixed;
  top: 8px;
  left: 1.3cm;
  right: 1.3cm;
  height: 20px;
  text-align: right;
  font-size: 8.5px;
  color: #6b7280;
  border-bottom: 1px solid #d1d5db;
  padding-bottom: 3px;
  font-family: sans-serif;
}
@else
@page { margin: 0; }
body { margin: 0; }
@endif

/* ── Utilities ───────────────────────────────────────── */
.b   { font-weight:bold; }
.ink { color:#1f2937; }
.mut { color:#6b7280; }
.fnt { color:#9ca3af; }
.r   { text-align:right; }
.c   { text-align:center; }
.sec   { width:100%; border-collapse:collapse; margin-bottom:8px; }
.cell  { border:1px solid #cbd5e1; border-top:2px solid #1f2937; padding:8px 11px; vertical-align:top; }
.nobrk { page-break-inside:avoid; }
.sl {
  font-size:7.5px; font-weight:bold; text-transform:uppercase;
  letter-spacing:1px; color:#6b7280;
  padding-bottom:4px; margin-bottom:6px; border-bottom:1px solid #e5e7eb;
}
.badge {
  display:inline-block; padding:2px 7px; font-size:7px; font-weight:bold;
  letter-spacing:1px; text-transform:uppercase;
  border:1px solid #9ca3af; color:#1f2937; background:#f3f4f6;
}
</style>
</head>
<body>
  @if(isset($is_dompdf) && $is_dompdf)
  <header>
    PURCHASE ORDER &nbsp;|&nbsp; PO No: {{ $po->po_number ?? 'DRAFT' }}
  </header>
  @endif

  <style>
/* ── Items table ─────────────────────────────────────── */
table.items { width:100%; border-collapse:collapse; }
table.items thead { display:table-header-group; }
table.items th {
  background:#1f2937; color:#fff; font-size:7.5px; font-weight:bold;
  text-transform:uppercase; letter-spacing:0.5px;
  padding:6px; border:1px solid #1f2937; text-align:left;
}
table.items th.r { text-align:right; }
table.items th.c { text-align:center; }
table.items td { padding:5px 6px; font-size:9px; color:#374151; border:1px solid #d1d5db; vertical-align:top; }
table.items tbody tr:nth-child(even) td { background:#f8f9fb; }

/* ── Totals ──────────────────────────────────────────── */
table.tot { width:100%; border-collapse:collapse; }
table.tot td { padding:5px 10px; font-size:9px; border:1px solid #d1d5db; }
table.tot .lbl { color:#6b7280; border-right:none; }
table.tot .val { text-align:right; font-weight:bold; color:#1f2937; border-left:none; }
table.tot .grand td { background:#1f2937; color:#fff; font-weight:bold; border-color:#1f2937; }

/* ── Terms ───────────────────────────────────────────── */
.sec-h {
  font-size:8px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;
  color:#1f2937; padding-bottom:4px; margin:4px 0 7px; border-bottom:1.5px solid #1f2937;
}
.terms-tbl { width:100%; border-collapse:collapse; }
.terms-tbl td { border:none; font-size:9px; color:#374151; line-height:1.5; padding:1px 2px; vertical-align:top; }
.terms-tbl td.sub { font-weight:bold; color:#1f2937; padding-top:8px; padding-bottom:2px; }
</style>

@php
$tenantLp = $po->tenant?->logo_path ? storage_path('app/public/'.$po->tenant->logo_path) : null;
$tenantLd = ($tenantLp && file_exists($tenantLp))
  ? 'data:'.mime_content_type($tenantLp).';base64,'.base64_encode(file_get_contents($tenantLp))
  : null;
$statusLabel = strtoupper(str_replace('_',' ',$po->status));
$tz          = 'Asia/Kolkata';
$createdAt   = $po->created_at  ? \Carbon\Carbon::parse($po->created_at)->timezone($tz)->format('d M Y, H:i')  : null;
$approvedAt  = $po->approved_at ? \Carbon\Carbon::parse($po->approved_at)->timezone($tz)->format('d M Y, H:i') : null;
$releasedAt  = $po->released_at ? \Carbon\Carbon::parse($po->released_at)->timezone($tz)->format('d M Y, H:i') : null;
$creatorRole = $po->created_by_role  ? ucwords(str_replace('_',' ',$po->created_by_role))  : null;
$approverRole= $po->approved_by_role ? ucwords(str_replace('_',' ',$po->approved_by_role)) : null;
$generatedAt = now()->timezone($tz)->format('d M Y, H:i').' IST';
if (!function_exists('_poNumWords')) {
  function _poNumWords(int $n): string {
    if ($n===0) return 'Zero';
    $ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
           'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    $tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    $w='';
    foreach([[10000000,'Crore'],[100000,'Lakh'],[1000,'Thousand'],[100,'Hundred']] as [$d,$name]) {
      if($n>=$d){$w.=_poNumWords((int)($n/$d)).' '.$name.' ';$n%=$d;}
    }
    if($n>=20){$w.=$tens[(int)($n/10)].' ';$n%=10;}
    if($n>0) $w.=$ones[$n].' ';
    return trim($w);
  }
}
$amtWords = _poNumWords((int) round($po->grand_total)).' Rupees Only';
if (!function_exists('_poTermsLines')) {
  function _poTermsLines(?string $raw): array {
    if(!$raw||trim($raw)==='') return [];
    $isHtml=(bool)preg_match('/<[a-z][\s\S]*>/i',$raw);
    $s=$raw;
    if($isHtml){
      $s=preg_replace('/<li[^>]*>/i',"\n• ",$s);
      $s=preg_replace('/<\/(p|div|li|ul|ol|h[1-6]|tr)>/i',"\n",$s);
      $s=preg_replace('/<br\s*\/?>/i',"\n",$s);
      $s=preg_replace('/<(style|script)\b[^>]*>.*?<\/\1>/is','',$s);
      $s=strip_tags($s,'<b><strong><i><em><u>');
      $s=preg_replace('/<(b|strong|i|em|u)\b[^>]*>/i','<$1>',$s);
    }
    $lines=preg_split('/\r?\n/',$s);
    $out=[];
    foreach($lines as $line){
      if(!$isHtml) $line=htmlspecialchars($line,ENT_QUOTES);
      if(trim(strip_tags($line))!=='') $out[]=trim($line);
    }
    return $out;
  }
}
$hasCode=$po->items->contains(fn($i)=>!empty($i->product_code??$i->product?->code));
$hasHSN =$po->items->contains(fn($i)=>!empty($i->hsn_code??$i->product?->hsn_code));
$hasUOM =$po->items->contains(fn($i)=>!empty($i->unit)||!empty($i->product?->unit));
$hasWar =$po->items->contains(fn($i)=>($i->warranty_months??0)>0);
$hasRB  =$po->items->contains(fn($i)=>!empty($i->required_by));
@endphp

{{-- PO number repeats via items table thead on every page --}}

{{-- ═══════════ PAGE 1 HEADER ═══════════ --}}
<table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1f2937;margin-bottom:10px;">
  <tr>
    <td style="width:52%;padding:0 8px 8px 0;vertical-align:bottom;">
      @if($tenantLd)
        <img src="{{ $tenantLd }}" alt="Logo" style="max-height:54px;max-width:200px;" />
        @if($po->tenant?->gstin)<div style="font-size:8px;color:#6b7280;margin-top:3px;">GSTIN: {{ $po->tenant->gstin }}</div>@endif
      @else
        <div style="font-size:16px;font-weight:bold;color:#1f2937;">{{ $po->tenant?->name ?? 'ZOPA Procurement' }}</div>
        @if($po->tenant?->gstin)<div style="font-size:8px;color:#6b7280;margin-top:2px;">GSTIN: {{ $po->tenant->gstin }}</div>@endif
      @endif
    </td>
    <td style="width:48%;padding:0 0 8px 8px;vertical-align:bottom;text-align:right;">
      <div style="font-size:16px;font-weight:bold;color:#1f2937;letter-spacing:1.5px;">PURCHASE ORDER</div>
      <div style="margin-top:5px;">
        @if(!empty($po->po_number))
          <span style="font-size:8.5px;color:#374151;"><strong>PO No:</strong>&nbsp;{{ $po->po_number }}</span>
          &nbsp;&nbsp;<span class="badge">{{ $statusLabel }}</span>
        @else
          <span style="font-size:8.5px;color:#374151;"><strong>PO No:</strong>&nbsp;DRAFT</span>
        @endif
      </div>
      @if($po->po_date)
      <div style="font-size:8.5px;color:#6b7280;margin-top:3px;">
        <strong>Date:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_date)->format('d M Y') }}
        @if($po->po_valid_till)&nbsp;&nbsp;<strong>Valid Till:</strong>&nbsp;{{ \Carbon\Carbon::parse($po->po_valid_till)->format('d M Y') }}@endif
      </div>
      @endif
      @if(!empty($po->pr_reference))
      <div style="font-size:8px;color:#9ca3af;margin-top:2px;"><strong>PR Ref:</strong>&nbsp;{{ $po->pr_reference }}</div>
      @endif
    </td>
  </tr>
</table>

{{-- ═══════════ VENDOR ═══════════ --}}
<table class="sec nobrk">
  <tr>
    <td class="cell" style="background:#fafafa;">
      <div class="sl">Vendor / Supplier</div>
      <div style="font-size:11.5px;font-weight:bold;color:#1f2937;margin-bottom:2px;">{{ $po->vendor?->name }}</div>
      @php $vgstin=$po->vendorAddress?->gstin??$po->vendor?->gstin; @endphp
      @if($vgstin)<div style="font-size:8.5px;color:#6b7280;margin-bottom:2px;">GSTIN: {{ $vgstin }}</div>@endif
      @if($po->vendorAddress)
        @php
          $va=$po->vendorAddress;
          $vLine2=collect([$va->city,$va->state])->filter()->implode(', ');
          if($va->state_code) $vLine2.=' ('.$va->state_code.')';
          if($va->pincode)    $vLine2=trim($vLine2).' - '.$va->pincode;
        @endphp
        <div style="font-size:9px;color:#374151;line-height:1.6;">
          @if($va->label){{ $va->label }}&nbsp;&mdash;&nbsp;@endif
          @if($va->address){{ $va->address }}@endif
          @if($vLine2)<br>{{ $vLine2 }}@endif
          @if($va->country)<br>{{ $va->country }}@endif
          @if($va->contact_name||$va->contact_phone)
            <br><span style="color:#6b7280;">Contact: {{ trim(($va->contact_name??'').($va->contact_phone?' · '.$va->contact_phone:'')) }}</span>
          @endif
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
      @if($po->costCenter&&!$po->billToLocation)
        <div style="font-size:10.5px;font-weight:bold;color:#1f2937;margin-bottom:2px;">{{ $po->costCenter->name }}</div>
        @if($po->costCenter->department)<div style="font-size:8.5px;color:#6b7280;">Dept: {{ $po->costCenter->department->name }}</div>@endif
        @if($po->costCenter->project)<div style="font-size:8.5px;color:#6b7280;">Project: {{ $po->costCenter->project->name }}</div>@endif
        @if($po->costCenter->location)<div style="font-size:8.5px;color:#6b7280;">Location: {{ $po->costCenter->location->name }}</div>@endif
      @endif
      @if($po->billToLocation)
        <div style="font-size:10.5px;font-weight:bold;color:#1f2937;margin-bottom:2px;">{{ $po->billToLocation->name }}</div>
        <div style="font-size:9px;color:#374151;line-height:1.55;">
          @include('pdf.partials.location-address',['loc'=>$po->billToLocation])
          @if($po->tenant?->gstin&&empty($po->billToLocation->gstin))<br>GSTIN: {{ $po->tenant->gstin }}@endif
        </div>
      @endif
      @if(!$po->costCenter&&!$po->billToLocation)
        <div style="font-size:9.5px;color:#1f2937;">{{ $po->tenant?->name }}</div>
      @endif
    </td>
    <td style="width:8px;border:none;"></td>
    <td class="cell" style="width:50%;">
      <div class="sl">Ship To</div>
      @if($po->shipToLocation)
        <div style="font-size:10.5px;font-weight:bold;color:#1f2937;margin-bottom:2px;">{{ $po->shipToLocation->name }}</div>
        <div style="font-size:9px;color:#374151;line-height:1.55;">
          @include('pdf.partials.location-address',['loc'=>$po->shipToLocation])
          @if($po->shipToLocation->receiver_name||$po->shipToLocation->receiver_phone)
            <div style="margin-top:4px;font-weight:bold;color:#475569;">
              Receiver: {{ $po->shipToLocation->receiver_name }} {{ $po->shipToLocation->receiver_phone?'('.$po->shipToLocation->receiver_phone.')':'' }}
            </div>
          @endif
        </div>
      @elseif($po->billToLocation)
        <div style="font-size:9px;color:#6b7280;font-style:italic;">Same as Bill To</div>
      @endif
    </td>
  </tr>
</table>

{{-- ═══════════ LINE ITEMS ═══════════ --}}
<table class="items" style="margin-bottom:8px;">
  <thead>
    <tr>
      <th colspan="99" style="background:#fff; border:none; border-bottom:1px solid #d1d5db; text-align:right; font-size:8px; font-weight:bold; color:#6b7280; padding:2px 0 3px 0; letter-spacing:0.3px;">
        PO No: {{ $po->po_number ?? 'DRAFT' }}
      </th>
    </tr>
    <tr>
      <th style="width:18px;" class="c">Sl<br>No</th>
      @if($hasCode)<th style="width:45px;">Code</th>@endif
      <th>Description / Specification</th>
      @if($hasHSN)<th style="width:35px;" class="c">HSN</th>@endif
      @if($hasUOM)<th style="width:28px;" class="c">UOM</th>@endif
      <th style="width:28px;" class="r">Qty</th>
      <th style="width:55px;" class="r">Unit Price</th>
      <th style="width:65px;" class="r">GST</th>
      <th style="width:65px;" class="r">Amount</th>
      @if($hasWar)<th style="width:35px;" class="c">Warranty</th>@endif
      @if($hasRB)<th style="width:50px;">Req. By</th>@endif
    </tr>
  </thead>
  <tbody>
    @foreach($po->items as $item)
    @php
      $baseAmount=($item->net_rate??0)*($item->qty??1);
      $lineGst=$baseAmount*($item->gst_rate??0)/100;
      $lineTotal=$baseAmount+$lineGst;
      $itCode=$item->product_code??$item->product?->code;
      $itName=$item->product_name??$item->product?->name;
      $itHsn=$item->hsn_code??$item->product?->hsn_code;
    @endphp
    <tr>
      <td class="c fnt" style="font-size:8px;">{{ $item->sno }}</td>
      @if($hasCode)<td style="font-size:8px;color:#6b7280;">{{ $itCode??'—' }}</td>@endif
      <td>
        <div style="font-weight:bold;color:#1f2937;font-size:9.5px;white-space:pre-wrap;">{{ $item->description }}</div>
        @if($itName&&$itName!==$item->description)<div style="font-size:7.5px;color:#6b7280;margin-top:2px;">Product: {{ $itName }}</div>@endif
        @if(!$hasCode&&$itCode&&$itCode!==$item->description)<div style="font-size:7.5px;color:#9ca3af;margin-top:1px;">{{ $itCode }}</div>@endif
        @if(!$hasHSN&&$itHsn)<div style="font-size:7.5px;color:#9ca3af;margin-top:1px;">HSN: {{ $itHsn }}</div>@endif
      </td>
      @if($hasHSN)<td class="c" style="font-size:8.5px;color:#475569;">{{ $itHsn??'—' }}</td>@endif
      @if($hasUOM)<td class="c" style="font-size:9px;">{{ $item->unit??$item->product?->unit??'—' }}</td>@endif
      <td class="r" style="font-size:9px;">{{ rtrim(rtrim(number_format($item->qty,3),'0'),'.') }}</td>
      <td class="r" style="font-size:9px;">&#8377;{{ number_format($item->net_rate,2) }}</td>
      <td class="r" style="font-size:9px;color:#475569;">
        {{ number_format($item->gst_rate,0) }}%
        @if($lineGst>0)<br><span style="font-size:7.5px;">(&#8377;{{ number_format($lineGst,2) }})</span>@endif
      </td>
      <td class="r b" style="font-size:9.5px;color:#1f2937;">&#8377;{{ number_format($lineTotal,2) }}</td>
      @if($hasWar)<td class="c" style="font-size:9px;color:#475569;">{{ ($item->warranty_months??0)>0?$item->warranty_months.' mo':'—' }}</td>@endif
      @if($hasRB)<td style="font-size:8.5px;color:#475569;">{{ $item->required_by?\Carbon\Carbon::parse($item->required_by)->format('d M Y'):'—' }}</td>@endif
    </tr>
    @endforeach
    @if($po->round_off!=0)
    <tr>
      <td class="c fnt" style="font-size:8px;">—</td>
      @if($hasCode)<td></td>@endif
      <td style="font-size:9px;color:#475569;font-style:italic;">Round Off</td>
      @if($hasHSN)<td></td>@endif
      @if($hasUOM)<td></td>@endif
      <td></td><td></td><td></td>
      <td class="r" style="font-size:9.5px;color:#475569;">{{ $po->round_off>0?'+':'' }}&#8377;{{ number_format($po->round_off,2) }}</td>
      @if($hasWar)<td></td>@endif
      @if($hasRB)<td></td>@endif
    </tr>
    @endif
  </tbody>
</table>

{{-- ═══════════ TOTALS ═══════════ --}}
<table style="width:100%;border-collapse:collapse;margin-bottom:8px;" class="nobrk">
  <tr>
    <td style="width:54%;border:1px solid #d1d5db;background:#f8f9fb;padding:8px 11px;vertical-align:top;">
      <div class="sl">Amount in Words</div>
      <div style="font-size:9.5px;color:#1f2937;line-height:1.5;">{{ $amtWords }}</div>
    </td>
    <td style="width:8px;border:none;"></td>
    <td style="width:46%;padding:0;vertical-align:top;">
      <table class="tot">
        <tr><td class="lbl">Net Total (before tax)</td><td class="val">&#8377;{{ number_format($po->net_total,2) }}</td></tr>
        @if($po->freight>0)
        <tr><td class="lbl">Freight{{ ($po->freight_gst_rate??0)>0?' (+'.number_format($po->freight_gst_rate,0).'% GST)':'' }}</td><td class="val">&#8377;{{ number_format($po->freight,2) }}</td></tr>
        @endif
        <tr><td class="lbl">GST / Tax Amount</td><td class="val">&#8377;{{ number_format($po->tax_amount,2) }}</td></tr>
        <tr class="grand">
          <td style="text-transform:uppercase;letter-spacing:0.5px;font-size:8.5px;">Grand Total</td>
          <td style="text-align:right;font-size:12.5px;">&#8377;{{ number_format(round($po->grand_total),2) }}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

{{-- ═══════════ TERMS & CONDITIONS ═══════════ --}}
@if(($po->payment_terms_json&&count($po->payment_terms_json))||$po->terms_conditions)
<div class="sec-h">Terms &amp; Conditions</div>
<table class="terms-tbl">
  @if($po->payment_terms_json&&count($po->payment_terms_json))
    <tr><td class="sub">Payment Schedule</td></tr>
    @foreach($po->payment_terms_json as $idx=>$pt)
      <tr><td>{{ $idx+1 }}.&nbsp;{{ $pt['stage'] }} — {{ $pt['percentage'] }}%@if(!empty($pt['credit_days'])&&$pt['credit_days']>0)&nbsp;({{ $pt['credit_days'] }} days credit)@endif</td></tr>
    @endforeach
  @endif
  @if($po->terms_conditions)
    @if($po->payment_terms_json&&count($po->payment_terms_json))<tr><td class="sub">General Terms</td></tr>@endif
    @foreach(_poTermsLines($po->terms_conditions) as $line)
      <tr><td>{!! $line !!}</td></tr>
    @endforeach
  @endif
</table>
<div style="margin-bottom:8px;"></div>
@endif

{{-- ═══════════ AUTHORISATION ═══════════ --}}
<table class="sec nobrk">
  <tr>
    <td class="cell">
      <div class="sl" style="margin-bottom:6px;">Authorisation &amp; Audit Trail</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding:3px 0;vertical-align:top;">
            <span class="mut" style="font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Prepared By</span><br>
            <span class="ink b" style="font-size:9.5px;">{{ $po->creator?->name??'—' }}</span>
            @if($creatorRole)<span class="mut" style="font-size:8px;">&nbsp;·&nbsp;{{ $creatorRole }}</span>@endif<br>
            <span class="mut" style="font-size:8.5px;">{{ $createdAt?'Created on '.$createdAt:'—' }}</span>
          </td>
          <td style="width:50%;padding:3px 0;vertical-align:top;">
            <span class="mut" style="font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Approved By</span><br>
            @if($po->approver?->name)
              <span class="ink b" style="font-size:9.5px;">{{ $po->approver->name }}</span>
              @if($approverRole)<span class="mut" style="font-size:8px;">&nbsp;·&nbsp;{{ $approverRole }}</span>@endif<br>
              <span class="mut" style="font-size:8.5px;">{{ $approvedAt?'Approved on '.$approvedAt:'Approved' }}</span>
            @elseif(str_contains($po->status,'approved')||in_array($po->status,['released','delivered','invoiced','payment_released']))
              <span class="ink b" style="font-size:9.5px;">System Auto-Approved</span><br>
              <span class="mut" style="font-size:8.5px;">{{ $approvedAt??'No approval level configured' }}</span>
            @else
              <span class="ink b" style="font-size:9.5px;">Pending Approval</span><br>
              <span class="mut" style="font-size:8.5px;">Status: {{ $statusLabel }}</span>
            @endif
            @if($releasedAt)<br><span class="mut" style="font-size:8px;">Released on {{ $releasedAt }}</span>@endif
          </td>
        </tr>
      </table>
      <div style="border-top:1px solid #e5e7eb;margin-top:7px;padding-top:6px;font-size:8.5px;color:#6b7280;font-style:italic;">
        System generated document. Generated in ZOPA P2P on {{ $generatedAt }}. No signature required.
      </div>
    </td>
  </tr>
</table>

</body>
</html>
