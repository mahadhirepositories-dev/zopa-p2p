<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; background: #f1f5f9; margin: 0; padding: 0; }
  .wrapper { max-width: 640px; margin: 24px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { padding: 22px 26px; color: #fff; background: #f97316; }
  .header h1 { margin: 0; font-size: 19px; }
  .header .sub { margin-top: 4px; font-size: 13px; opacity: .92; }
  .body { padding: 24px 26px; }
  .doc-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 14px 0; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { padding: 3px 0; vertical-align: top; }
  table.kv .k { color: #64748b; font-size: 12px; width: 130px; }
  table.kv .v { font-size: 13px; }
  .items-title { font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: .05em; margin: 18px 0 6px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.items th { background: #475569; color: #fff; padding: 7px 8px; text-align: left; font-weight: bold; }
  table.items td { padding: 6px 8px; border-bottom: 1px solid #eef2f7; }
  table.items tbody tr:nth-child(even) { background: #f8fafc; }
  .attach-note { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 18px 0; border-radius: 0 6px 6px 0; font-size: 13px; }
  .footer { background: #f1f5f9; padding: 14px 26px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Purchase Order {{ $docNumber }}</h1>
    <div class="sub">Issued by {{ $buyerOrg }}</div>
  </div>
  <div class="body">
    <p>Dear {{ $vendorName }},</p>
    <p>Please find the details of Purchase Order <strong>{{ $docNumber }}</strong> issued to you by
       <strong>{{ $buyerOrg }}</strong>. The complete purchase order is attached as a PDF.</p>

    @include('emails.partials.doc-table')

    <div class="attach-note">
      &#128206; The complete Purchase Order (including terms &amp; conditions) is attached as
      <strong>PO-{{ $docNumber }}.pdf</strong>. Kindly review and acknowledge receipt.
    </div>

    <p>For any questions regarding this order, please contact {{ $buyerOrg }} directly.</p>
  </div>
  <div class="footer">ZOPA Procurement Platform &bull; This is an automated message. Please do not reply to this email.</div>
</div>
</body>
</html>
