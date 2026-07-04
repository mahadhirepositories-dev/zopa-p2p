<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Approve — ZOPA Procurement</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background: #f1f5f9; margin: 0; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { background: #fff; max-width: 480px; width: 92%; border-radius: 14px; box-shadow: 0 6px 30px rgba(0,0,0,0.10); overflow: hidden; }
  .bar { height: 6px; background: #16a34a; }
  .inner { padding: 30px 32px; text-align: center; }
  h1 { margin: 0 0 4px; font-size: 20px; color: #1e293b; }
  .doc { color: #64748b; font-size: 14px; margin-bottom: 20px; }
  .btn { margin-top: 8px; width: 100%; padding: 13px; border: 0; border-radius: 8px; background: #16a34a; color: #fff; font-size: 15px; font-weight: bold; cursor: pointer; }
  .note { margin-top: 14px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="inner">
      <h1>Approve this document?</h1>
      <div class="doc">{{ $docLabel }}</div>

      <form method="POST" action="{{ url('/api/email/approval/' . $token . '/approve') }}">
        <button type="submit" class="btn">Confirm Approval</button>
      </form>

      <div class="note">Click to confirm your approval. This link works once.</div>
    </div>
  </div>
</body>
</html>
