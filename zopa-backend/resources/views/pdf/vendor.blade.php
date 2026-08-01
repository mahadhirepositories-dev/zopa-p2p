<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @if(isset($is_dompdf) && $is_dompdf)
    body { margin: 1.2cm 1.3cm; }
    header {
      position: fixed;
      top: 8px;
      left: 1.3cm;
      right: 1.3cm;
      height: 20px;
      text-align: right;
      font-size: 8.5px;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      font-family: DejaVu Sans, sans-serif;
    }
  @else
    @page { margin: 0; }
    body { margin: 0; }
  @endif

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; color: #1e293b; line-height: 1.45; }
  .title { font-size: 18px; font-weight: bold; color: #15803d; }
  .muted { color: #64748b; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge { display: inline-block; padding: 2px 7px; font-size: 7.5px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; border-radius: 3px; }
  .badge-active { background: #dcfce7; color: #166534; }
  .badge-inactive { background: #fef2f2; color: #991b1b; }
  
  table { width: 100%; border-collapse: collapse; }
  .grid-table td { padding: 4px 6px; vertical-align: top; }
  .k { color: #64748b; font-size: 8.5px; text-transform: uppercase; display: block; margin-bottom: 2px; }
  .v { font-weight: bold; font-size: 9.5px; color: #0f172a; }

  .section-title { font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 14px 0 8px 0; }
  
  .data-table { margin-top: 6px; }
  .data-table th { background: #166534; color: #fff; padding: 5px 6px; text-align: left; font-size: 8px; text-transform: uppercase; }
  .data-table td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
  .data-table tr:nth-child(even) td { background: #f8fafc; }
  .right { text-align: right; }
  .mono { font-family: monospace; }
</style>
</head>
<body>
  @if(isset($is_dompdf) && $is_dompdf)
  <header>
    VENDOR PROFILE &nbsp;|&nbsp; CODE: {{ $vendor->global_vendor_code ?? 'N/A' }}
  </header>
  @endif

  <table style="border-bottom:2px solid #166534;padding-bottom:8px;margin-bottom:12px;">
    <tr>
      <td>
        <div class="title">VENDOR MASTER PROFILE</div>
        <div class="muted" style="margin-top:2px;">{{ optional($vendor->tenant)->name }}</div>
      </td>
      <td class="right" style="vertical-align:top;">
        <div style="font-size:13px;font-weight:bold;color:#0f172a;">{{ $vendor->global_vendor_code ?: 'N/A' }}</div>
        <div style="margin-top:4px;">
          <span class="badge {{ $vendor->is_active ? 'badge-active' : 'badge-inactive' }}">
            {{ $vendor->is_active ? 'ACTIVE VENDOR' : 'INACTIVE VENDOR' }}
          </span>
        </div>
      </td>
    </tr>
  </table>

  <!-- Basic Info -->
  <div class="section-title">General Information</div>
  <table class="grid-table">
    <tr>
      <td width="33%"><span class="k">Vendor Name</span><span class="v">{{ $vendor->name }}</span></td>
      <td width="33%"><span class="k">Global Vendor Code</span><span class="v">{{ $vendor->global_vendor_code ?? '—' }}</span></td>
      <td width="34%"><span class="k">Entity Code</span><span class="v">{{ $vendor->entity_code ?? '—' }}</span></td>
    </tr>
    <tr>
      <td><span class="k">Email Address</span><span class="v">{{ $vendor->email ?? '—' }}</span></td>
      <td><span class="k">Phone Number</span><span class="v">{{ $vendor->phone ?? '—' }}</span></td>
      <td><span class="k">Default Currency</span><span class="v">{{ $vendor->currency ?? 'INR' }}</span></td>
    </tr>
    <tr>
      <td><span class="k">Vendor Type</span><span class="v">{{ ucfirst(str_replace('_', ' ', $vendor->vendor_type ?? '—')) }}</span></td>
      <td><span class="k">Entity Type</span><span class="v">{{ ucfirst(str_replace('_', ' ', $vendor->entity_type ?? '—')) }}</span></td>
      <td><span class="k">Primary Category</span><span class="v">{{ optional($vendor->category)->name ?? '—' }}</span></td>
    </tr>
  </table>

  <!-- Tax & Compliance -->
  <div class="section-title">Tax &amp; Compliance Details</div>
  <table class="grid-table">
    <tr>
      <td width="33%"><span class="k">PAN Number</span><span class="v mono">{{ $vendor->pan_not_available ? 'NOT AVAILABLE' : ($vendor->pan ?? '—') }}</span></td>
      <td width="33%"><span class="k">GST Status</span><span class="v">{{ ucfirst($vendor->gst_status ?? '—') }}</span></td>
      <td width="34%"><span class="k">GSTIN</span><span class="v mono">{{ $vendor->gstin ?? '—' }}</span></td>
    </tr>
    <tr>
      <td><span class="k">Special Status (MSME/SEZ)</span><span class="v">{{ strtoupper(str_replace('_', ' ', $vendor->special_status ?? 'N/A')) }}</span></td>
      <td><span class="k">Registration No</span><span class="v">{{ $vendor->special_status_reg_no ?? '—' }}</span></td>
      <td><span class="k">Validity Period</span><span class="v">{{ $vendor->special_status_start_date ? $vendor->special_status_start_date->format('d/m/Y') : '' }} {{ $vendor->special_status_end_date ? ' to ' . $vendor->special_status_end_date->format('d/m/Y') : '—' }}</span></td>
    </tr>
  </table>

  <!-- Bank Details -->
  <div class="section-title">Bank Account Details</div>
  <table class="grid-table">
    <tr>
      <td width="33%"><span class="k">Account Number</span><span class="v mono">{{ $vendor->account_no ?? '—' }}</span></td>
      <td width="33%"><span class="k">IFSC Code</span><span class="v mono">{{ $vendor->ifsc ?? '—' }}</span></td>
      <td width="34%"><span class="k">MICR Code</span><span class="v mono">{{ $vendor->micr ?? '—' }}</span></td>
    </tr>
    <tr>
      <td><span class="k">Bank Name</span><span class="v">{{ $vendor->bank_name ?? '—' }}</span></td>
      <td><span class="k">Branch Name</span><span class="v">{{ $vendor->branch_name ?? '—' }}</span></td>
      <td></td>
    </tr>
  </table>

  <!-- Compliance Documents -->
  @if($vendor->documents && $vendor->documents->count() > 0)
  <div class="section-title">Attached Compliance &amp; Registration Documents</div>
  <table class="data-table">
    <thead>
      <tr>
        <th width="25%">Document Type</th>
        <th width="50%">Original File Name</th>
        <th width="25%">Date Uploaded</th>
      </tr>
    </thead>
    <tbody>
      @foreach($vendor->documents as $doc)
      <tr>
        <td><strong>{{ strtoupper(str_replace('_', ' ', $doc->document_type)) }}</strong></td>
        <td>{{ $doc->original_name }}</td>
        <td>{{ $doc->created_at ? $doc->created_at->format('d M Y, H:i') : '—' }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>
  @endif

  <!-- Registered Addresses -->
  @if($vendor->addresses && $vendor->addresses->count() > 0)
  <div class="section-title">Registered Addresses</div>
  <table class="data-table">
    <thead>
      <tr>
        <th width="20%">Label</th>
        <th width="45%">Address</th>
        <th width="15%">City / State</th>
        <th width="20%">GSTIN</th>
      </tr>
    </thead>
    <tbody>
      @foreach($vendor->addresses as $addr)
      <tr>
        <td><strong>{{ $addr->label }}</strong> {{ $addr->is_default ? '(Default)' : '' }}</td>
        <td>{{ $addr->address }}, {{ $addr->pincode }}</td>
        <td>{{ $addr->city ?? '—' }}, {{ $addr->state ?? '—' }}</td>
        <td class="mono">{{ $addr->gstin ?? '—' }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>
  @endif

  <!-- Associated Purchase Orders Summary -->
  @if($vendor->purchaseOrders && $vendor->purchaseOrders->count() > 0)
  <div class="section-title">Associated Purchase Orders (Recent {{ min(10, $vendor->purchaseOrders->count()) }})</div>
  <table class="data-table">
    <thead>
      <tr>
        <th width="25%">PO Number</th>
        <th width="25%">Date</th>
        <th width="25%">Status</th>
        <th width="25%" class="right">Grand Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      @foreach($vendor->purchaseOrders->take(10) as $po)
      <tr>
        <td><strong>{{ $po->po_number ?? ('PO #' . $po->id) }}</strong></td>
        <td>{{ $po->created_at ? $po->created_at->format('d M Y') : '—' }}</td>
        <td>{{ strtoupper(str_replace('_', ' ', $po->status)) }}</td>
        <td class="right"><strong>₹{{ number_format($po->grand_total, 2) }}</strong></td>
      </tr>
      @endforeach
    </tbody>
  </table>
  @endif

</body>
</html>
