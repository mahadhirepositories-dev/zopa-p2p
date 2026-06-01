<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; background: #f1f5f9; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 24px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { padding: 22px 26px; color: #fff; background: #f97316; }
  .header h1 { margin: 0; font-size: 19px; }
  .body { padding: 26px; line-height: 1.55; }
  .btn-wrap { text-align: center; margin: 26px 0; }
  .btn { display: inline-block; background: #f97316; color: #fff !important; text-decoration: none;
         padding: 13px 30px; border-radius: 8px; font-weight: bold; font-size: 15px; }
  .muted { color: #64748b; font-size: 12px; }
  .link-fallback { word-break: break-all; font-size: 12px; color: #2563eb; }
  .footer { background: #f1f5f9; padding: 14px 26px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>Password Reset Request</h1></div>
  <div class="body">
    <p>Hi {{ $userName }},</p>
    <p>We received a request to reset the password for your ZOPA Procurement account.
       Click the button below to choose a new password.</p>

    <div class="btn-wrap">
      <a class="btn" href="{{ $resetUrl }}">Reset Password</a>
    </div>

    <p class="muted">This link expires in {{ $expiresMinutes }} minutes and can be used only once.
       If the button doesn't work, copy and paste this URL into your browser:</p>
    <p class="link-fallback">{{ $resetUrl }}</p>

    <p class="muted">If you didn't request a password reset, you can safely ignore this email —
       your password will remain unchanged.</p>
  </div>
  <div class="footer">ZOPA Procurement Platform &bull; This is an automated message. Please do not reply.</div>
</div>
</body>
</html>
