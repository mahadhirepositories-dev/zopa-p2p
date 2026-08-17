<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Reject — ZOPA Procurement</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background: #f1f5f9; margin: 0; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { background: #fff; max-width: 480px; width: 92%; border-radius: 14px; box-shadow: 0 6px 30px rgba(0,0,0,0.10); overflow: hidden; }
  .bar { height: 6px; background: #dc2626; }
  .inner { padding: 30px 32px; }
  h1 { margin: 0 0 4px; font-size: 20px; color: #1e293b; }
  .doc { color: #64748b; font-size: 14px; margin-bottom: 18px; }
  label { display: block; font-size: 13px; font-weight: bold; color: #475569; margin-bottom: 6px; }
  textarea { width: 100%; box-sizing: border-box; min-height: 110px; padding: 11px 13px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical; }
  .btn { margin-top: 16px; width: 100%; padding: 13px; border: 0; border-radius: 8px; background: #dc2626; color: #fff; font-size: 15px; font-weight: bold; cursor: pointer; }
  .note { margin-top: 14px; font-size: 12px; color: #94a3b8; text-align: center; }
  .err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; font-size: 13px; margin-bottom: 14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="inner">
      <h1>Reject this document?</h1>
      <div class="doc">{{ $docLabel }}</div>

      @if (!empty($error))
        <div class="err">{{ $error }}</div>
      @endif

      <form method="POST" action="">
        <label for="remarks">Reason for rejection <span style="color:#dc2626;">*</span></label>
        <textarea id="remarks" name="remarks" required placeholder="Briefly explain why this is being rejected…"></textarea>
        <button type="submit" class="btn">Confirm Rejection</button>
      </form>

      <div class="note">This action is final and will notify the requester. The link works once.</div>
    </div>
  </div>
</body>
</html>
