<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{ $title }} — ZOPA Procurement</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background: #f1f5f9; margin: 0; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { background: #fff; max-width: 460px; width: 92%; border-radius: 14px; box-shadow: 0 6px 30px rgba(0,0,0,0.10); overflow: hidden; text-align: center; }
  .bar { height: 6px; background: {{ $color }}; }
  .inner { padding: 38px 32px; }
  .mark { width: 64px; height: 64px; border-radius: 50%; background: {{ $color }}1a; color: {{ $color }}; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; margin-bottom: 18px; }
  h1 { margin: 0 0 8px; font-size: 21px; color: #1e293b; }
  p { margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; }
  .foot { margin-top: 26px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="inner">
      <div class="mark">{{ $ok ? '✓' : '!' }}</div>
      <h1>{{ $title }}</h1>
      <p>{{ $message }}</p>
      <div class="foot">ZOPA Procurement Platform · You may now close this window.</div>
    </div>
  </div>
</body>
</html>
