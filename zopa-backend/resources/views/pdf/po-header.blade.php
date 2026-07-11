<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 16px; overflow: hidden; }
  body {
    font-family: Arial, sans-serif;
    font-size: 9px;
    color: #1f2937;
    background: #fff;
  }
  .header-bar {
    width: 100%;
    height: 16px;
    line-height: 16px;
    padding: 0 13mm;
    border-bottom: 1.5px solid #1f2937;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
  }
  .left  { font-weight: bold; font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px; color: #1f2937; }
  .right { font-size: 8.5px; color: #374151; }
  .right strong { color: #1f2937; }
</style>
</head>
<body>
  <div class="header-bar">
    <span class="right"><strong>PO No:</strong>&nbsp;{{ $po_number }}</span>
  </div>
</body>
</html>
