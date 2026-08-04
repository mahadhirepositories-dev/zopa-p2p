<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; background: #f1f5f9; margin: 0; padding: 0; }
  .wrapper { max-width: 640px; margin: 24px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { padding: 22px 26px; color: #fff; }
  .header.approved { background: #16a34a; }
  .header.rejected { background: #dc2626; }
  .header.returned { background: #ea580c; }
  .header.needs_clarification { background: #0284c7; }
  .header h1 { margin: 0; font-size: 19px; }
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
  .comments { background: #fff7ed; border-left: 4px solid #ea580c; padding: 12px 16px; margin: 18px 0; border-radius: 0 6px 6px 0; font-size: 13px; }
  .comments.needs_clarification { background: #f0f9ff; border-left-color: #0284c7; }
  .footer { background: #f1f5f9; padding: 14px 26px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  @php
    $icon = match($event) { 'approved' => '&#10003;', 'rejected' => '&#10007;', 'returned' => '&#8617;', 'needs_clarification' => '&#63;', default => '' };
  @endphp
  <div class="header {{ $event }}">
    <h1>{!! $icon !!} {{ $docTitle }} {{ $docNumber }} — {{ $statusLabel }}</h1>
  </div>
  <div class="body">
    <p>Your {{ strtolower($docTitle) }} <strong>{{ $docNumber }}</strong> has been marked as <strong>{{ $statusLabel }}</strong>.</p>

    @include('emails.partials.doc-table')

    @if ($comments)
      <div class="comments {{ $event }}">
        <strong>{{ $event === 'needs_clarification' ? 'Buyer Comments / Questions:' : 'Reviewer remarks:' }}</strong><br>
        {{ $comments }}
      </div>
    @endif

    @if ($event === 'approved')
      <p>No further action is needed from you for this approval step.</p>
    @elseif ($event === 'returned')
      <p>Please review the remarks above, make the necessary changes, and resubmit.</p>
    @elseif ($event === 'rejected')
      <p>This document has been rejected. Contact your approver if you need clarification.</p>
    @elseif ($event === 'needs_clarification')
      <p>Please log into ZOPA P2P and provide the clarification requested above under the Requisitions tab.</p>
    @endif
  </div>
  <div class="footer">ZOPA Procurement Platform &bull; Automated notification. Please do not reply.</div>
</div>
</body>
</html>
