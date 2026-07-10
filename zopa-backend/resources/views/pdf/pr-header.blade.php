<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 8px;
    color: #6b7280;
  }
  .header-bar {
    width: 100%;
    text-align: right;
    padding: 0 13mm 3px 13mm;
    border-bottom: 1px solid #e5e7eb;
    font-size: 8px;
    color: #6b7280;
    letter-spacing: 0.3px;
  }
</style>
</head>
<body>
  <div class="header-bar">
    PURCHASE REQUISITION &nbsp;|&nbsp; PR No: {{ $pr_number }}
  </div>
</body>
</html>
