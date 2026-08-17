<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 24px 30px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
  .body { padding: 30px; }
  .meta-grid { background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px; }
  .meta-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .meta-label { color: #64748b; font-weight: 600; }
  .meta-val { color: #0f172a; font-weight: 700; }
  .msg-box { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #0c4a6e; }
  .btn-link { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; }
  .footer { padding: 20px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Purchase Requisition Status Update</h1>
      <p>{{ $pr->pr_number ?? ('PR #' . $pr->id) }} &mdash; {{ $pr->title }}</p>
    </div>
    <div class="body">
      <div class="meta-grid">
        <div class="meta-row"><span class="meta-label">PR Number:</span><span class="meta-val">{{ $pr->pr_number ?? ('PR #' . $pr->id) }}</span></div>
        <div class="meta-row"><span class="meta-label">PR Title:</span><span class="meta-val">{{ $pr->title }}</span></div>
        <div class="meta-row"><span class="meta-label">Sent By (Buyer):</span><span class="meta-val">{{ $sentBy->name }} ({{ $sentBy->email }})</span></div>
        @if(!empty($ccEmails))
          <div class="meta-row"><span class="meta-label">CC Tagged:</span><span class="meta-val">{{ implode(', ', $ccEmails) }}</span></div>
        @endif
      </div>

      <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#334155;">Status Message from Buyer:</div>
      <div class="msg-box">{{ $updateMessage }}</div>

      <div style="text-align:center;margin-top:28px;">
        <a href="{{ secure_url('/purchase-requisitions/' . $pr->id) }}" class="btn-link">View Purchase Requisition in ZOPA</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification sent from ZOPA Procurement Platform.
    </div>
  </div>
</body>
</html>
