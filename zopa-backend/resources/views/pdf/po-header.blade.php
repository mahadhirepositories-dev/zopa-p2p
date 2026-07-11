<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #1f2937; }
  .header-bar {
    width: 100%;
    display: table;
    padding: 5px 13mm 5px 13mm;
    border-bottom: 2px solid #1f2937;
    background: #fff;
  }
  .header-left {
    display: table-cell;
    text-align: left;
    font-size: 9px;
    font-weight: bold;
    color: #1f2937;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .header-right {
    display: table-cell;
    text-align: right;
    font-size: 9px;
    color: #374151;
  }
  .header-right strong { color: #1f2937; }
</style>
</head>
<body>
  <div class="header-bar">
    <span class="header-left">Purchase Order</span>
    <span class="header-right">
      <strong>PO No:</strong>&nbsp;{{ $po_number }}
    </span>
  </div>
</body>
</html>
