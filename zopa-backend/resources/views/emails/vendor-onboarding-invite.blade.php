<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; background: #f1f5f9; margin: 0; padding: 0; }
  .wrapper { max-width: 580px; margin: 24px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { padding: 24px 28px; color: #fff; background: #ea580c; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
  .body { padding: 28px; line-height: 1.6; }
  .org-box { background: #fff7ed; border-left: 4px solid #ea580c; padding: 12px 16px; margin: 18px 0; border-radius: 0 6px 6px 0; }
  .org-box strong { color: #9a3412; }
  .btn-wrap { text-align: center; margin: 28px 0; }
  .btn { display: inline-block; background: #ea580c; color: #ffffff !important; text-decoration: none;
         padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 15px; letter-spacing: 0.02em; }
  .instructions { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .instructions h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
  .instructions ul { margin: 0; padding-left: 20px; color: #475569; font-size: 13px; }
  .instructions li { margin-bottom: 4px; }
  .notice { color: #b45309; background: #fef3c7; border-radius: 6px; padding: 10px 14px; font-size: 12px; margin-top: 20px; }
  .muted { color: #64748b; font-size: 12px; margin-top: 16px; }
  .link-fallback { word-break: break-all; font-size: 12px; color: #2563eb; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Vendor Registration Invitation</h1>
    <p>{{ $tenantName ?? 'ZOPA Procurement Partner' }}</p>
  </div>
  <div class="body">
    <p>Dear {{ $vendorName ?? 'Partner' }},</p>
    <p>You have been invited by <strong>{{ $tenantName ?? 'our organization' }}</strong> to register as an approved vendor on the ZOPA P2P Procurement Platform.</p>

    <div class="org-box">
      <strong>Registration Form:</strong> {{ $templateName ?? 'Vendor Onboarding Form' }}<br>
      <strong>Organization:</strong> {{ $tenantName ?? 'ZOPA Network' }}
    </div>

    @if(!empty($description))
      <p>{{ $description }}</p>
    @endif

    <div class="instructions">
      <h3>Documents you may need:</h3>
      <ul>
        <li>Company PAN Card copy</li>
        <li>GST Registration Certificate (if registered)</li>
        <li>Cancelled Cheque / Official Bank Passbook copy for EFT details</li>
        <li>MSME / Udyam Certificate (if applicable)</li>
      </ul>
    </div>

    <div class="btn-wrap">
      <a class="btn" href="{{ $onboardingUrl }}" target="_blank">Complete Vendor Registration</a>
    </div>

    <div class="notice">
      &#9888; <strong>Important Notice:</strong> This is a secure <strong>single-use</strong> registration link. Once submitted, the link will expire automatically and cannot be reused. This invitation is valid until <strong>{{ $expiresAt ?? '7 days' }}</strong>.
    </div>

    <p class="muted">If the button above does not work, copy and paste this link into your web browser:</p>
    <p class="link-fallback">{{ $onboardingUrl }}</p>

    <p class="muted">If you have any questions or received this invitation in error, please contact the procurement team directly.</p>
  </div>
  <div class="footer">
    ZOPA P2P Procurement Suite &bull; This is an automated notification. Please do not reply directly to this email.
  </div>
</div>
</body>
</html>
