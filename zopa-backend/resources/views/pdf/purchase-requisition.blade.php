<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  /* DomPDF-safe: DejaVu Sans, no emoji, no font-weight:600, no height:100% */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1e293b; line-height: 1.45; }
  .title { font-size: 18px; font-weight: bold; color: #1976d2; }
  .muted { color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .badge { display: inline-block; padding: 2px 8px; font-size: 7px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; border-radius: 3px; background: #fef3c7; color: #92400e; }
  table { width: 100%; border-collapse: collapse; }
  .hdr td { padding: 2px 0; vertical-align: top; }
  .hdr .k { color: #64748b; width: 90px; }
  .items { margin-top: 14px; }
  .items th { background: #1976d2; color: #fff; padding: 6px 7px; text-align: left; font-size: 8px; text-transform: uppercase; }
  .items td { padding: 6px 7px; border-bottom: 1px solid #e2e8f0; }
  .items tr:nth-child(even) td { background: #f8fafc; }
  .right { text-align: right; }
  .totals { margin-top: 12px; width: 240px; float: right; }
  .totals td { padding: 4px 6px; }
  .totals .lbl { color: #64748b; }
  .grand { font-weight: bold; font-size: 12px; border-top: 1px solid #cbd5e1; }
</style>
</head>
<body>
  <table style="border-bottom:2px solid #1976d2;padding-bottom:8px;">
    <tr>
      <td>
        <div class="title">PURCHASE REQUISITION</div>
        <div class="muted" style="margin-top:2px;">{{ optional($pr->tenant)->name }}</div>
      </td>
      <td class="right" style="vertical-align:top;">
        <div style="font-size:13px;font-weight:bold;">{{ $pr->pr_number ?: 'DRAFT' }}</div>
        <div class="muted" style="margin-top:3px;">{{ \Illuminate\Support\Carbon::parse($pr->created_at)->format('d M Y') }}</div>
        <div style="margin-top:4px;"><span class="badge">{{ str_replace('_',' ', $pr->status) }}</span></div>
      </td>
    </tr>
  </table>

  <table class="hdr" style="margin-top:12px;">
    <tr>
      <td style="width:50%;">
        <table class="hdr">
          <tr><td class="k">Title</td><td>{{ $pr->title }}</td></tr>
          <tr><td class="k">Cost Center</td><td>{{ optional($pr->costCenter)->name ?? '-' }}</td></tr>
          <tr><td class="k">Project</td><td>{{ optional($pr->project)->name ?? '-' }}</td></tr>
          <tr><td class="k">Location</td><td>{{ optional($pr->location)->name ?? '-' }}</td></tr>
        </table>
      </td>
      <td style="width:50%;">
        <table class="hdr">
          <tr><td class="k">Priority</td><td>{{ ucfirst($pr->priority ?? 'normal') }}</td></tr>
          <tr><td class="k">Required By</td><td>{{ $pr->required_by_date ? \Illuminate\Support\Carbon::parse($pr->required_by_date)->format('d M Y') : '-' }}</td></tr>
          <tr><td class="k">Requested By</td><td>{{ optional($pr->requestedBy)->name ?? '-' }}</td></tr>
          <tr><td class="k">Est. Amount</td><td>Rs {{ number_format((float) $pr->estimated_amount, 2) }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  @if ($pr->description)
    <div style="margin-top:10px;"><span class="muted">Description</span><br>{{ $pr->description }}</div>
  @endif

  <table class="items">
    <thead>
      <tr>
        <th style="width:24px;">#</th>
        <th>Description</th>
        <th style="width:60px;" class="right">Qty</th>
        <th style="width:50px;">Unit</th>
        <th style="width:80px;" class="right">Est. Rate</th>
        <th style="width:90px;" class="right">Est. Amount</th>
      </tr>
    </thead>
    <tbody>
      @php $grand = 0; @endphp
      @foreach ($pr->items as $i => $it)
        @php $line = (float) $it->qty * (float) ($it->estimated_price ?? 0); $grand += $line; @endphp
        <tr>
          <td>{{ $it->sno ?? $i + 1 }}</td>
          <td>{{ $it->description }}</td>
          <td class="right">{{ rtrim(rtrim(number_format((float) $it->qty, 3), '0'), '.') }}</td>
          <td>{{ $it->unit ?? 'Nos' }}</td>
          <td class="right">{{ number_format((float) ($it->estimated_price ?? 0), 2) }}</td>
          <td class="right">{{ number_format($line, 2) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>

  <table class="totals">
    <tr class="grand"><td class="lbl">Estimated Total</td><td class="right">Rs {{ number_format($grand, 2) }}</td></tr>
  </table>

  <div style="clear:both;"></div>
</body>
</html>
