{{-- Shared header + line-items table for approval / status emails --}}
<div class="doc-card">
  <table class="kv">
    @foreach ($headerRows as $label => $value)
      <tr><td class="k">{{ $label }}</td><td class="v">{{ $value }}</td></tr>
    @endforeach
  </table>
</div>

@if (count($items))
  <div class="items-title">Line Items</div>
  <table class="items">
    <thead>
      <tr>
        <th style="width:28px;">#</th>
        <th>Description</th>
        <th style="width:55px;text-align:right;">Qty</th>
        <th style="width:45px;">Unit</th>
        <th style="width:75px;text-align:right;">Rate</th>
        <th style="width:45px;text-align:right;">Tax</th>
        <th style="width:90px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($items as $it)
        <tr>
          <td>{{ $it['sno'] }}</td>
          <td>{{ $it['description'] }}</td>
          <td style="text-align:right;">{{ $it['qty'] }}</td>
          <td>{{ $it['unit'] }}</td>
          <td style="text-align:right;">{{ $it['rate'] }}</td>
          <td style="text-align:right;">{{ $it['tax'] }}</td>
          <td style="text-align:right;">{{ $it['amount'] }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>
@endif
