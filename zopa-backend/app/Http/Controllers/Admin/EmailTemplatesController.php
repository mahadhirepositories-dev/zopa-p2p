<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\View;

/**
 * Read-only catalogue of the system email templates, rendered with representative
 * sample data, for the Super Admin "Email Templates" screen. This lets a Super
 * Admin see exactly what each automated email looks like without sending one.
 */
class EmailTemplatesController extends Controller
{
    public function index(): JsonResponse
    {
        // Shared sample document (a Purchase Order) used across previews.
        $headerRows = [
            'Vendor'      => 'Acme Industrial Supplies Pvt Ltd',
            'Cost Center' => 'IT Infrastructure',
            'PO Date'     => now()->format('d M Y'),
            'Valid Till'  => now()->addDays(30)->format('d M Y'),
            'Net Total'   => 'Rs 1,20,000.00',
            'Tax'         => 'Rs 21,600.00',
            'Grand Total' => 'Rs 1,41,600.00',
        ];

        $items = [
            ['sno' => 1, 'description' => 'Dell Latitude 5440 Laptop', 'qty' => '4', 'unit' => 'Nos', 'rate' => '25,000.00', 'tax' => '18%', 'amount' => '1,18,000.00'],
            ['sno' => 2, 'description' => 'USB-C Docking Station',      'qty' => '4', 'unit' => 'Nos', 'rate' => '5,000.00',  'tax' => '18%', 'amount' => '23,600.00'],
        ];

        $docNumber = 'ACME-PO-2026-0042';
        $buyerOrg  = 'Acme Corporation';

        $templates = [
            [
                'key'         => 'password_reset',
                'name'        => 'Password Reset',
                'recipient'   => 'User requesting the reset',
                'trigger'     => 'Sent when a user submits the "Forgot password?" form.',
                'subject'     => 'Reset your ZOPA password',
                'html'        => View::make('emails.password-reset', [
                    'userName'       => 'Rahul Sharma',
                    'resetUrl'       => rtrim((string) config('app.frontend_url'), '/') . '/reset-password?token=SAMPLE-TOKEN&email=rahul@example.com',
                    'expiresMinutes' => (int) config('auth.passwords.users.expire', 60),
                ])->render(),
            ],
            [
                'key'         => 'po_issued',
                'name'        => 'Purchase Order Issued to Vendor',
                'recipient'   => 'Vendor (vendor email on file)',
                'trigger'     => 'Sent to the vendor when a PO is released, or via "Send to Vendor".',
                'subject'     => "Purchase Order {$docNumber} from {$buyerOrg}",
                'html'        => View::make('emails.po-issued', [
                    'docTitle'   => 'Purchase Order',
                    'docNumber'  => $docNumber,
                    'buyerOrg'   => $buyerOrg,
                    'vendorName' => 'Acme Industrial Supplies Pvt Ltd',
                    'headerRows' => $headerRows,
                    'items'      => $items,
                ])->render(),
            ],
            [
                'key'         => 'approval_request',
                'name'        => 'Approval Request',
                'recipient'   => 'Assigned approver at each level',
                'trigger'     => 'Sent to an approver when a PR/PO reaches their approval level.',
                'subject'     => "Action Required: Purchase Order {$docNumber} — Level 1 Approval",
                'html'        => View::make('emails.approval-request', [
                    'docTitle'     => 'Purchase Order',
                    'docNumber'    => $docNumber,
                    'approval'     => (object) ['level' => 1],
                    'approverName' => 'Priya Menon',
                    'approveUrl'   => '#',
                    'rejectUrl'    => '#',
                    'headerRows'   => $headerRows,
                    'items'        => $items,
                ])->render(),
            ],
            [
                'key'         => 'document_status',
                'name'        => 'Document Status Update',
                'recipient'   => 'Document creator / requester',
                'trigger'     => 'Sent to the source when a PR/PO is approved, returned, or rejected.',
                'subject'     => "Purchase Order {$docNumber} — Approved",
                'html'        => View::make('emails.document-status', [
                    'docTitle'    => 'Purchase Order',
                    'docNumber'   => $docNumber,
                    'statusLabel' => 'Approved',
                    'event'       => 'approved',
                    'comments'    => 'Approved within budget. Please proceed with the order.',
                    'headerRows'  => $headerRows,
                    'items'       => $items,
                ])->render(),
            ],
        ];

        return response()->json($templates);
    }
}
