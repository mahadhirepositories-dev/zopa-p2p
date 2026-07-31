<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 28px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; background: #eff6ff; color: #2563eb; }
        h2 { margin-top: 12px; color: #0f172a; font-size: 20px; }
        .details { margin: 20px 0; background: #f1f5f9; padding: 16px; border-radius: 6px; font-size: 14px; }
        .details p { margin: 6px 0; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .footer { font-size: 12px; color: #64748b; margin-top: 24px; text-align: center; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">{{ str_replace('_', ' ', $deliveryStatus) }}</span>
        <h2>Delivery Alert for {{ $po->po_number ?? 'PO #' . $po->id }}</h2>
        <p>This is a notification that the vendor/buyer has marked <strong>{{ $po->po_number ?? 'PO #' . $po->id }}</strong> as <strong>{{ ucwords(str_replace('_', ' ', $deliveryStatus)) }}</strong>.</p>

        <div class="details">
            <p><strong>Vendor:</strong> {{ optional($po->vendor)->name ?? '—' }}</p>
            <p><strong>Cost Center:</strong> {{ optional($po->costCenter)->name ?? '—' }}</p>
            <p><strong>Grand Total:</strong> ₹{{ number_format((float) $po->grand_total, 2) }}</p>
            @if ($notes)
                <p><strong>Delivery Notes:</strong> {{ $notes }}</p>
            @endif
        </div>

        <p>Please log in to ZOPA P2P and record the Goods Received Note (GRN) for this delivery.</p>

        <div class="footer">
            &copy; {{ date('Y') }} {{ optional($po->tenant)->name ?? 'ZOPA P2P' }}. All rights reserved.
        </div>
    </div>
</body>
</html>
