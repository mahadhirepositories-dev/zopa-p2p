<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; background: #f1f5f9; margin: 0; padding: 0; }
  .wrapper { max-width: 580px; margin: 24px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { padding: 24px 28px; color: #fff; background: #0284c7; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
  .body { padding: 28px; line-height: 1.6; }
  .badge-row { margin: 12px 0 20px; }
  .badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 99px; }
  .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  .details-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
  .details-table td.label { font-weight: 600; color: #64748b; width: 35%; background: #f8fafc; }
  .details-table td.value { color: #0f172a; font-weight: 500; }
  .btn-wrap { text-align: center; margin: 28px 0; }
  .btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none;
         padding: 13px 30px; border-radius: 8px; font-weight: bold; font-size: 14px; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>New Vendor Onboarding Response</h1>
    <p>{{ $tenantName ?? 'ZOPA Procurement' }}</p>
  </div>
  <div class="body">
    <div class="badge-row">
      <span class="badge">Action Required &bull; Ready for Review</span>
    </div>

    <p>Hello Admin / Procurement Team,</p>
    <p>A prospective vendor has successfully submitted their registration form and uploaded their compliance documents.</p>

    <table class="details-table">
      <tr>
        <td class="label">Vendor / Trade Name</td>
        <td class="value"><strong>{{ $vendorName ?? '—' }}</strong></td>
      </tr>
      <tr>
        <td class="label">Contact Email</td>
        <td class="value">{{ $vendorEmail ?? '—' }}</td>
      </tr>
      @if(!empty($vendorPhone))
      <tr>
        <td class="label">Contact Phone</td>
        <td class="value">{{ $vendorPhone }}</td>
      </tr>
      @endif
      <tr>
        <td class="label">Form Template</td>
        <td class="value">{{ $templateName ?? 'Vendor Onboarding Form' }}</td>
      </tr>
      <tr>
        <td class="label">Organization</td>
        <td class="value">{{ $tenantName ?? '—' }}</td>
      </tr>
      <tr>
        <td class="label">Submitted At</td>
        <td class="value">{{ $submittedAt ?? now()->format('d M Y, h:i A') }}</td>
      </tr>
    </table>

    <p>Please review the submitted particulars and attached verification documents (PAN, GSTIN, Bank details). Once verified, you can approve the vendor into the live P2P vendor pool with a single click.</p>

    <div class="btn-wrap">
      <a class="btn" href="{{ $reviewUrl }}" target="_blank">Review Vendor Submission</a>
    </div>
  </div>
  <div class="footer">
    ZOPA P2P Procurement Suite &bull; This is an automated notification.
  </div>
</div>
</body>
</html>
