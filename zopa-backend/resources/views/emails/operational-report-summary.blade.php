<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 680px; margin: 24px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 14px rgba(15,23,42,0.08); border: 1px solid #e2e8f0; }
  .header { background: #0f2942; color: #ffffff; padding: 24px 28px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .header .sub { margin-top: 6px; font-size: 13px; color: #94a3b8; }
  .body { padding: 26px 28px; }
  .greeting { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
  .intro { font-size: 13.5px; color: #475569; line-height: 1.6; margin-bottom: 20px; }
  .custom-note { background: #f1f5f9; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #334155; margin-bottom: 22px; font-style: italic; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 20px 0 10px; }
  
  /* KPI Grid Table */
  table.kpi-grid { width: 100%; border-collapse: separate; border-spacing: 10px; margin: 0 -10px 20px; }
  table.kpi-grid td { width: 33.33%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; vertical-align: top; }
  .kpi-num { font-size: 22px; font-weight: 700; color: #0f2942; margin-bottom: 3px; }
  .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .kpi-warn { color: #dc2626 !important; }
  .kpi-success { color: #16a34a !important; }

  .attach-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 24px 0; display: flex; align-items: center; }
  .attach-title { font-weight: 600; font-size: 13px; color: #1e3a8a; }
  .attach-sub { font-size: 12px; color: #3b82f6; margin-top: 2px; }

  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Operational Procurement Review</h1>
    <div class="sub">{{ $tenantName }} &bull; {{ $docTitle }}</div>
  </div>

  <div class="body">
    <div class="greeting">Dear {{ $recipientName }},</div>
    <div class="intro">
      Please find the latest operational procurement review for <strong>{{ $tenantName }}</strong> below. The complete, detailed McKinsey-style executive briefing document with comprehensive turnaround time (TAT) charts, open requisitions, pending approvals, and delivery logistics tracking is attached as a PDF.
    </div>

    @if(!empty($customMessage))
      <div class="custom-note">
        <strong>Buyer's Operational Note:</strong><br>
        {{ $customMessage }}
      </div>
    @endif

    <div class="section-title">Executive Scorecard Summary</div>
    <table class="kpi-grid">
      <tr>
        <td>
          <div class="kpi-num kpi-success">{{ $metrics['prs_closed'] ?? 0 }}</div>
          <div class="kpi-label">PRs Closed in Period</div>
        </td>
        <td>
          <div class="kpi-num">{{ $metrics['avg_pr_tat_days'] ?? 0 }}d</div>
          <div class="kpi-label">Average PR TAT</div>
        </td>
        <td>
          <div class="kpi-num">{{ $metrics['pos_issued'] ?? 0 }}</div>
          <div class="kpi-label">POs Issued in Period</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="kpi-num">{{ $metrics['total_open_prs'] ?? 0 }}</div>
          <div class="kpi-label">Total Open PRs</div>
        </td>
        <td>
          <div class="kpi-num {{ ($metrics['prs_tat_gt_10'] ?? 0) > 0 ? 'kpi-warn' : '' }}">
            {{ $metrics['prs_tat_gt_10'] ?? 0 }}
          </div>
          <div class="kpi-label">PRs TAT &gt; 10 Days</div>
        </td>
        <td>
          <div class="kpi-num {{ ($metrics['pending_deliveries'] ?? 0) > 5 ? 'kpi-warn' : '' }}">
            {{ $metrics['pending_deliveries'] ?? 0 }}
          </div>
          <div class="kpi-label">Pending Deliveries</div>
        </td>
      </tr>
    </table>

    <div class="attach-card">
      <div>
        <div class="attach-title">&#128206; Attached: Full Executive Report (PDF)</div>
        <div class="attach-sub">Contains complete item-level remarks, approval statuses, delivery lead-times, and action items.</div>
      </div>
    </div>

    <p style="font-size:13px;color:#475569;margin-top:16px;">
      Prepared by <strong>{{ $buyerName }}</strong> (<a href="mailto:{{ $buyerEmail }}" style="color:#0284c7;text-decoration:none;">{{ $buyerEmail }}</a>)<br>
      ZOPA Central Procurement Operations &bull; Inquiries: <a href="mailto:rajashyam@zopapro.com" style="color:#0284c7;text-decoration:none;">rajashyam@zopapro.com</a>
    </p>
  </div>

  <div class="footer">
    ZOPA Procurement Platform &bull; Automated Operational Report &bull; Confidential &bull; Generated on {{ now()->format('d M Y, H:i') }}
  </div>
</div>
</body>
</html>
