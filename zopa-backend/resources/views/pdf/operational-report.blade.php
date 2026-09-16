<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{{ $report->title }}</title>
<style>
  @page {
    size: A4 landscape;
    margin: 10mm 12mm 12mm 12mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #1e293b;
    margin: 0;
    padding: 0;
    background: #ffffff;
    line-height: 1.4;
  }

  /* Header Masthead */
  .masthead {
    background: #0f2942;
    color: #ffffff;
    padding: 14px 20px;
    border-radius: 4px;
    margin-bottom: 12px;
    border-bottom: 3px solid #0284c7;
  }
  .masthead table { width: 100%; border-collapse: collapse; }
  .masthead .title { font-size: 18px; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; margin: 0; }
  .masthead .org-name { font-size: 13px; color: #38bdf8; font-weight: 600; margin-top: 3px; }
  .masthead .meta-right { text-align: right; font-size: 10.5px; color: #cbd5e1; }
  .masthead .meta-badge { display: inline-block; background: #0369a1; color: #ffffff; padding: 3px 8px; border-radius: 3px; font-weight: 700; font-size: 9.5px; text-transform: uppercase; margin-bottom: 4px; }

  /* KPI Scorecard */
  .kpi-table { width: 100%; border-collapse: separate; border-spacing: 6px; margin-bottom: 12px; }
  .kpi-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-top: 3px solid #0f2942;
    border-radius: 4px;
    padding: 10px 12px;
    vertical-align: top;
  }
  .kpi-box.warn { border-top-color: #ea580c; background: #fff7ed; }
  .kpi-box.danger { border-top-color: #dc2626; background: #fef2f2; }
  .kpi-box.success { border-top-color: #16a34a; background: #f0fdf4; }
  .kpi-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin-bottom: 3px; }
  .kpi-value { font-size: 20px; font-weight: 800; color: #0f2942; line-height: 1.1; }
  .kpi-box.warn .kpi-value { color: #c2410c; }
  .kpi-box.danger .kpi-value { color: #b91c1c; }
  .kpi-box.success .kpi-value { color: #15803d; }
  .kpi-sub { font-size: 9px; color: #64748b; margin-top: 2px; }

  /* Chart Layout (2 columns) */
  .charts-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .charts-table td { width: 50%; vertical-align: top; }
  .chart-card {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 10px 14px;
  }
  .chart-header {
    font-size: 11px;
    font-weight: 700;
    color: #0f2942;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 5px;
    margin-bottom: 8px;
  }
  .chart-header span { font-size: 9px; font-weight: normal; color: #64748b; text-transform: none; }

  /* Bar Row */
  .bar-row { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .bar-row td { padding: 2px 0; }
  .bar-label { width: 28%; font-size: 9.5px; font-weight: 600; color: #334155; }
  .bar-track { width: 58%; background: #e2e8f0; border-radius: 2px; height: 10px; overflow: hidden; }
  .bar-fill { height: 10px; border-radius: 2px; background: #0284c7; }
  .bar-fill.accent { background: #0f2942; }
  .bar-fill.warn { background: #f97316; }
  .bar-fill.danger { background: #ef4444; }
  .bar-val { width: 14%; text-align: right; font-size: 9.5px; font-weight: 700; color: #0f2942; }

  /* Data Section Titles */
  .section-banner {
    background: #e2e8f0;
    border-left: 4px solid #0f2942;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 700;
    color: #0f2942;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 12px 0 6px;
  }

  /* Data Tables */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
    margin-bottom: 10px;
    page-break-inside: auto;
  }
  table.data-table th {
    background: #0f2942;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 5px 6px;
    border: 1px solid #0f2942;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  table.data-table td {
    padding: 5px 6px;
    border: 1px solid #cbd5e1;
    vertical-align: middle;
  }
  table.data-table tr:nth-child(even) { background: #f8fafc; }
  table.data-table tr:hover { background: #f1f5f9; }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  .badge-warn { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
  .badge-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .badge-info { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
  .badge-neutral { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

  .remarks-cell {
    color: #0f172a;
    font-weight: 500;
    background: #fefce8;
    border-left: 2px solid #eab308;
    padding-left: 6px;
  }

  .page-break { page-break-before: always; }

  /* Footer */
  .doc-footer {
    border-top: 1px solid #cbd5e1;
    padding-top: 6px;
    margin-top: 10px;
    font-size: 8.5px;
    color: #64748b;
  }
  .doc-footer table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

  <!-- Masthead -->
  <div class="masthead">
    <table>
      <tr>
        <td style="vertical-align:middle;">
          <div class="title">OPERATIONAL PROCUREMENT STATUS REPORT</div>
          <div class="org-name">{{ $report->tenant?->name ?? 'Client Organization' }} &bull; Operational Review</div>
        </td>
        <td class="meta-right" style="vertical-align:middle;">
          <span class="meta-badge">CONFIDENTIAL &bull; EXECUTIVE REVIEW</span><br>
          <strong>Reporting Period:</strong> {{ $report->period_start ? \Carbon\Carbon::parse($report->period_start)->format('d M Y') : '—' }} to {{ $report->period_end ? \Carbon\Carbon::parse($report->period_end)->format('d M Y') : '—' }}<br>
          <strong>Generated:</strong> {{ now()->format('d M Y, H:i') }} &bull; Prepared by: {{ $report->creator?->name ?? 'Procurement Buyer' }}
        </td>
      </tr>
    </table>
  </div>

  <!-- Executive KPI Scorecard -->
  @php
    $m = $report->metrics_data ?? [];
    $prsClosed = $m['prs_closed'] ?? 0;
    $avgTat = $m['avg_pr_tat_days'] ?? 0;
    $posIssued = $m['pos_issued'] ?? 0;
    $posVal = $m['pos_issued_value'] ?? 0;
    $totalOpenPrs = $m['total_open_prs'] ?? 0;
    $tatGt10 = $m['prs_tat_gt_10'] ?? 0;
    $pendingDel = $m['pending_deliveries'] ?? 0;
  @endphp
  <table class="kpi-table">
    <tr>
      <td class="kpi-box success" style="width: 16.6%;">
        <div class="kpi-title">PRs Closed</div>
        <div class="kpi-value">{{ $prsClosed }}</div>
        <div class="kpi-sub">Converted in period</div>
      </td>
      <td class="kpi-box" style="width: 16.6%;">
        <div class="kpi-title">Average PR TAT</div>
        <div class="kpi-value">{{ $avgTat }} <span style="font-size:12px;font-weight:normal;">Days</span></div>
        <div class="kpi-sub">Submit &rarr; PO Draft</div>
      </td>
      <td class="kpi-box" style="width: 16.6%;">
        <div class="kpi-title">POs Issued</div>
        <div class="kpi-value">{{ $posIssued }}</div>
        <div class="kpi-sub">₹{{ number_format($posVal) }}</div>
      </td>
      <td class="kpi-box" style="width: 16.6%;">
        <div class="kpi-title">Total Open PRs</div>
        <div class="kpi-value">{{ $totalOpenPrs }}</div>
        <div class="kpi-sub">Active in pipeline</div>
      </td>
      <td class="kpi-box {{ $tatGt10 > 0 ? 'danger' : 'success' }}" style="width: 16.6%;">
        <div class="kpi-title">PRs TAT &gt; 10 Days</div>
        <div class="kpi-value">{{ $tatGt10 }}</div>
        <div class="kpi-sub">{{ $tatGt10 > 0 ? 'Requires attention' : 'Within threshold' }}</div>
      </td>
      <td class="kpi-box {{ $pendingDel > 5 ? 'warn' : '' }}" style="width: 16.6%;">
        <div class="kpi-title">Pending Deliveries</div>
        <div class="kpi-value">{{ $pendingDel }}</div>
        <div class="kpi-sub">Awaiting vendor GRN</div>
      </td>
    </tr>
  </table>

  <!-- Visual Charts Section (Executive Risk & TAT Distribution) -->
  @php
    $tatDist = $m['tat_distribution'] ?? ['< 1 Day' => 0, '1 - 3 Days' => 0, '4 - 7 Days' => 0, '8 - 10 Days' => 0, '> 10 Days' => 0];
    $maxTatVal = max(1, max(array_values($tatDist)));

    $delRisk = $m['delivery_risk'] ?? ['On Track (0-3d)' => 0, 'Moderate (4-7d)' => 0, 'Delayed (> 7d)' => 0];
    $maxRiskVal = max(1, max(array_values($delRisk)));
  @endphp
  <table class="charts-table">
    <tr>
      <td style="padding-right: 6px;">
        <div class="chart-card">
          <div class="chart-header">
            1. Open PR Turnaround Time (TAT) Aging Distribution
            <span style="float:right;">Benchmark: &lt; 3 Days</span>
          </div>
          @foreach($tatDist as $label => $val)
            @php
              $pct = round(($val / $maxTatVal) * 100);
              $colorClass = str_contains($label, '> 10') ? 'danger' : (str_contains($label, '8 - 10') ? 'warn' : 'accent');
            @endphp
            <table class="bar-row">
              <tr>
                <td class="bar-label">{{ $label }}</td>
                <td>
                  <div class="bar-track">
                    <div class="bar-fill {{ $colorClass }}" style="width: {{ max(4, $pct) }}%;"></div>
                  </div>
                </td>
                <td class="bar-val">{{ $val }} PRs</td>
              </tr>
            </table>
          @endforeach
        </div>
      </td>
      <td style="padding-left: 6px;">
        <div class="chart-card">
          <div class="chart-header">
            2. Delivery Logistics &amp; Fulfillment Risk Profile
            <span style="float:right;">Target: On-Track &gt; 80%</span>
          </div>
          @foreach($delRisk as $label => $val)
            @php
              $pct = round(($val / $maxRiskVal) * 100);
              $colorClass = str_contains($label, 'Delayed') ? 'danger' : (str_contains($label, 'Moderate') ? 'warn' : 'accent');
            @endphp
            <table class="bar-row">
              <tr>
                <td class="bar-label">{{ $label }}</td>
                <td>
                  <div class="bar-track">
                    <div class="bar-fill {{ $colorClass }}" style="width: {{ max(4, $pct) }}%;"></div>
                  </div>
                </td>
                <td class="bar-val">{{ $val }} POs</td>
              </tr>
            </table>
          @endforeach
        </div>
      </td>
    </tr>
  </table>

  <!-- Table 1: Open Purchase Requisitions -->
  <div class="section-banner">1. Active Purchase Requisitions &bull; Status &amp; Action Plan</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 8%;">PR Number</th>
        <th style="width: 7%;">Date</th>
        <th style="width: 25%;">Scope &bull; Title</th>
        <th style="width: 12%;">Cost Center</th>
        <th style="width: 12%;">Requested By</th>
        <th style="width: 9%;">Status</th>
        <th style="width: 6%; text-align:right;">Age</th>
        <th style="width: 21%;">Team Remarks &bull; Operational Plan</th>
      </tr>
    </thead>
    <tbody>
      @forelse($report->open_prs_data ?? [] as $pr)
        @php
          $statusClass = match(strtolower($pr['status'] ?? '')) {
            'converted'           => 'badge-success',
            'partially_converted' => 'badge-info',
            'rfq_approved'        => 'badge-success',
            'rfq_created'         => 'badge-info',
            'submitted'           => 'badge-warn',
            'draft'               => 'badge-neutral',
            'needs_clarification' => 'badge-danger',
            default               => 'badge-neutral',
          };
        @endphp
        <tr>
          <td><strong>{{ $pr['pr_number'] ?? '—' }}</strong></td>
          <td>{{ $pr['created_at'] ?? '—' }}</td>
          <td>{{ $pr['title'] ?? '—' }}</td>
          <td>{{ $pr['cost_center'] ?? '—' }}</td>
          <td>{{ $pr['requested_by'] ?? '—' }}</td>
          <td><span class="badge {{ $statusClass }}">{{ str_replace('_', ' ', $pr['status'] ?? '—') }}</span></td>
          <td style="text-align:right;">{{ $pr['age_days'] ?? 0 }}d</td>
          <td class="remarks-cell">{{ !empty($pr['remarks']) ? $pr['remarks'] : 'Pending procurement review' }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="8" style="text-align:center;color:#64748b;padding:12px;">No open purchase requisitions currently pending.</td>
        </tr>
      @endforelse
    </tbody>
  </table>

  <!-- Page Break if many rows -->
  @if(count($report->open_prs_data ?? []) > 8)
    <div class="page-break"></div>
  @endif

  <!-- Table 2: Pending PO Approvals -->
  <div class="section-banner">2. Purchase Orders Pending Client Approval</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 12%;">PO Number</th>
        <th style="width: 9%;">PO Date</th>
        <th style="width: 24%;">Vendor Name</th>
        <th style="width: 12%; text-align:right;">Value (Inc GST)</th>
        <th style="width: 14%;">Cost Center</th>
        <th style="width: 10%;">Approval Stage</th>
        <th style="width: 7%; text-align:right;">Waiting</th>
        <th style="width: 12%;">Notes</th>
      </tr>
    </thead>
    <tbody>
      @forelse($report->pending_pos_data ?? [] as $po)
        <tr>
          <td><strong>{{ $po['po_number'] ?? '—' }}</strong></td>
          <td>{{ $po['created_at'] ?? '—' }}</td>
          <td>{{ $po['vendor_name'] ?? '—' }}</td>
          <td style="text-align:right;">₹{{ number_format($po['grand_total'] ?? 0) }}</td>
          <td>{{ $po['cost_center'] ?? '—' }}</td>
          <td><span class="badge badge-warn">{{ $po['approval_level'] ?? 'L1 Review' }}</span></td>
          <td style="text-align:right;">{{ $po['waiting_days'] ?? 0 }}d</td>
          <td>{{ !empty($po['remarks']) ? $po['remarks'] : 'Awaiting approver sign-off' }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="8" style="text-align:center;color:#64748b;padding:10px;">No purchase orders currently pending approval.</td>
        </tr>
      @endforelse
    </tbody>
  </table>

  <!-- Table 3: Deliveries & Fulfillment -->
  <div class="section-banner">3. Delivery Logistics &amp; Goods Receipt Tracking</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 11%;">PO Number</th>
        <th style="width: 8%;">Release Date</th>
        <th style="width: 20%;">Vendor Name</th>
        <th style="width: 22%;">Description / Material Scope</th>
        <th style="width: 10%; text-align:right;">Value</th>
        <th style="width: 6%; text-align:right;">Age</th>
        <th style="width: 9%;">Status</th>
        <th style="width: 14%;">Team Remarks &bull; ETA</th>
      </tr>
    </thead>
    <tbody>
      @forelse($report->deliveries_data ?? [] as $del)
        @php
          $dStatus = $del['status'] ?? 'On Track';
          $dClass = match($dStatus) {
            'On Track' => 'badge-success',
            'Moderate' => 'badge-warn',
            'Delayed'  => 'badge-danger',
            default    => 'badge-neutral',
          };
        @endphp
        <tr>
          <td><strong>{{ $del['po_number'] ?? '—' }}</strong></td>
          <td>{{ $del['released_at'] ?? '—' }}</td>
          <td>{{ $del['vendor_name'] ?? '—' }}</td>
          <td>{{ $del['description'] ?? '—' }}</td>
          <td style="text-align:right;">₹{{ number_format($del['grand_total'] ?? 0) }}</td>
          <td style="text-align:right;">{{ $del['days_since_release'] ?? 0 }}d</td>
          <td><span class="badge {{ $dClass }}">{{ $dStatus }}</span></td>
          <td class="remarks-cell">{{ !empty($del['remarks']) ? $del['remarks'] : 'In transit / awaiting site GRN' }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="8" style="text-align:center;color:#64748b;padding:10px;">All issued purchase orders have been delivered.</td>
        </tr>
      @endforelse
    </tbody>
  </table>

  <!-- Table 4: Key Tasks & Action Items -->
  <div class="section-banner">4. Operational Action Items &bull; Team Tasks</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 4%;">#</th>
        <th style="width: 36%;">Action Item / Specific Task</th>
        <th style="width: 16%;">Owner</th>
        <th style="width: 12%;">Target Date</th>
        <th style="width: 10%;">Status</th>
        <th style="width: 22%;">Remarks &bull; Dependencies</th>
      </tr>
    </thead>
    <tbody>
      @forelse($report->tasks_data ?? [] as $idx => $t)
        @php
          $tStatus = $t['status'] ?? 'Pending';
          $tClass = match($tStatus) {
            'Completed'   => 'badge-success',
            'In Progress' => 'badge-info',
            'Pending'     => 'badge-warn',
            'Blocked'     => 'badge-danger',
            default       => 'badge-neutral',
          };
        @endphp
        <tr>
          <td>{{ $idx + 1 }}</td>
          <td><strong>{{ $t['task'] ?? '—' }}</strong></td>
          <td>{{ $t['owner'] ?? '—' }}</td>
          <td>{{ $t['due_date'] ?? '—' }}</td>
          <td><span class="badge {{ $tClass }}">{{ $tStatus }}</span></td>
          <td>{{ $t['remarks'] ?? '—' }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="6" style="text-align:center;color:#64748b;padding:8px;">No pending action items recorded.</td>
        </tr>
      @endforelse
    </tbody>
  </table>

  <!-- Document Footer -->
  <div class="doc-footer">
    <table>
      <tr>
        <td>
          ZOPA Procurement Operations Platform &bull; Executive Briefing Document &bull; Confidential
        </td>
        <td style="text-align:right;">
          ZOPA Central Operations &bull; Inquiries: rajashyam@zopapro.com
        </td>
      </tr>
    </table>
  </div>

</body>
</html>
