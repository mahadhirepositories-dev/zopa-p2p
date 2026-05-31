<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a2332; margin: 20px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  .meta { color: #64748b; margin-bottom: 16px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; font-size: 9px; font-weight: 700; text-transform: uppercase;
       letter-spacing: .04em; color: #64748b; padding: 6px 8px; border: 1px solid #e2e8f0; }
  td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .tat-good   { color: #16a34a; font-weight: 700; }
  .tat-medium { color: #d97706; font-weight: 700; }
  .tat-bad    { color: #dc2626; font-weight: 700; }
  .na         { color: #94a3b8; }
</style>
</head>
<body>
<h1>TAT Report — {{ $tenant->name }}</h1>
<div class="meta">Generated: {{ $date }}</div>

<table>
  <thead>
    <tr>
      <th>PO Number</th>
      <th>Vendor</th>
      <th>Cost Center</th>
      <th>PR Number</th>
      <th>Amount (₹)</th>
      <th>PR→PO (d)</th>
      <th>PR→Approval (d)</th>
      <th>PR→Release (d)</th>
      <th>PR→Delivery (d)</th>
      <th>PR→Invoice (d)</th>
    </tr>
  </thead>
  <tbody>
    @forelse ($rows as $row)
    <tr>
      <td>{{ $row['po_number'] }}</td>
      <td>{{ $row['vendor'] }}</td>
      <td>{{ $row['cost_center'] }}</td>
      <td>{{ $row['pr_number'] }}</td>
      <td>{{ number_format($row['grand_total'], 0) }}</td>
      @foreach (['tat_pr_to_po','tat_pr_to_approval','tat_pr_to_release','tat_pr_to_delivery','tat_pr_to_invoice'] as $k)
      <td>
        @if (is_null($row[$k]))
          <span class="na">—</span>
        @elseif ($row[$k] <= 2)
          <span class="tat-good">{{ $row[$k] }}d</span>
        @elseif ($row[$k] <= 7)
          <span class="tat-medium">{{ $row[$k] }}d</span>
        @else
          <span class="tat-bad">{{ $row[$k] }}d</span>
        @endif
      </td>
      @endforeach
    </tr>
    @empty
    <tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:20px;">No records found</td></tr>
    @endforelse
  </tbody>
</table>
</body>
</html>
