<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; background: #f1f5f9; margin: 0; padding: 0; }
  .wrapper { max-width: 640px; margin: 24px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { background: #1976d2; color: #fff; padding: 22px 26px; }
  .header h1 { margin: 0; font-size: 19px; }
  .header .sub { margin-top: 4px; font-size: 13px; opacity: .9; }
  .body { padding: 24px 26px; }
  .doc-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 14px 0; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { padding: 3px 0; vertical-align: top; }
  table.kv .k { color: #64748b; font-size: 12px; width: 130px; }
  table.kv .v { font-size: 13px; }
  .items-title { font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: .05em; margin: 18px 0 6px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.items th { background: #1976d2; color: #fff; padding: 7px 8px; text-align: left; font-weight: bold; }
  table.items td { padding: 6px 8px; border-bottom: 1px solid #eef2f7; }
  table.items tbody tr:nth-child(even) { background: #f8fafc; }
  .actions { margin-top: 26px; text-align: center; }
  .btn { display: inline-block; padding: 13px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 6px; font-size: 14px; }
  .btn-approve { background: #16a34a; color: #fff; }
  .btn-reject { background: #dc2626; color: #fff; }
  .note { margin-top: 22px; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  .footer { background: #f1f5f9; padding: 14px 26px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>{{ $docTitle }} {{ $docNumber }}</h1>
    <div class="sub">Level {{ $approval->level }} approval required</div>
  </div>
  <div class="body">
    <p>Hello {{ $approverName }},</p>
    <p>The following {{ strtolower($docTitle) }} has been submitted and needs your approval at <strong>Level {{ $approval->level }}</strong>. The full details and a PDF copy are included for your review.</p>

    @include('emails.partials.doc-table')

    <div class="actions">
      <a href="{{ $approveUrl }}" class="btn btn-approve">&#10003; Approve</a>
      <a href="{{ $rejectUrl }}" class="btn btn-reject">&#10007; Reject</a>
    </div>

    <p class="note">
      Approve / Reject act instantly from this email — no login needed.<br>
      These links are unique to you, can be used once, and expire in 72 hours.<br>
      Prefer the app? Log in to ZOPA Procurement to review and act there.
    </p>
  </div>
  <div class="footer">ZOPA Procurement Platform &bull; Automated approval request. Please do not reply.</div>
</div>
</body>
</html>
