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
                    'docTitle'     => 'Purchase Order',
                    'docNumber'    => $docNumber,
                    'buyerOrg'     => $buyerOrg,
                    'vendorName'   => 'Acme Industrial Supplies Pvt Ltd',
                    'contactName'  => 'Bharani',
                    'contactPhone' => '+917022207585',
                    'headerRows' => [
                        'Issued By'   => $buyerOrg . '  ·  GSTIN: 29ABCDE1234F1Z5',
                        'PO Date'     => now()->format('d M Y'),
                        'Needed By'   => now()->addDays(20)->format('d M Y'),
                        'Valid Till'  => now()->addDays(30)->format('d M Y'),
                        'Net Total'   => 'Rs 1,20,000.00',
                        'Tax'         => 'Rs 21,600.00',
                        'Grand Total' => 'Rs 1,41,600.00',
                    ],
                    'items'      => $items,
                    'billTo'     => ['name' => $buyerOrg . ' — Head Office', 'lines' => ['12 MG Road', 'Bengaluru, Karnataka - 560001', 'India', 'GSTIN: 29ABCDE1234F1Z5']],
                    'shipTo'     => ['name' => $buyerOrg . ' — Central Warehouse', 'lines' => ['Plot 7, Industrial Area, Phase II', 'Bengaluru, Karnataka - 560099', 'India']],
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
            [
                'key'         => 'pr_clarification',
                'name'        => 'PR Clarification Request',
                'recipient'   => 'PR Raiser (requester email)',
                'trigger'     => 'Sent to the PR raiser when a Buyer requests clarification with questions/comments.',
                'subject'     => 'Clarification Requested for Purchase Requisition PR-2026-0012',
                'html'        => View::make('emails.document-status', [
                    'docTitle'    => 'Purchase Requisition',
                    'docNumber'   => 'PR-2026-0012',
                    'statusLabel' => 'Needs Clarification',
                    'event'       => 'needs_clarification',
                    'comments'    => 'Please provide detailed specifications for the docking station and clarify if L14 warranty is covered.',
                    'headerRows'  => [
                        'Requester'   => 'Haritha D',
                        'Cost Center' => 'IT Infrastructure',
                        'Date'        => now()->format('d M Y'),
                    ],
                    'items'       => $items,
                ])->render(),
            ],
            [
                'key'         => 'grn_nudge',
                'name'        => 'GRN Nudge Alert (Delivery Marked)',
                'recipient'   => 'Store Managers / GRN Handlers',
                'trigger'     => 'Sent to store managers and GRN handlers when a PO is marked as partially delivered or delivered.',
                'subject'     => 'Delivery Alert: PO-2026-0042 is Partially Delivered - Please Record GRN',
                'html'        => View::make('emails.grn-nudge', [
                    'po'             => (object) [
                        'po_number'  => 'PO-2026-0042',
                        'vendor'     => (object) ['name' => 'Acme Industrial Supplies Pvt Ltd'],
                        'costCenter' => (object) ['name' => 'IT Infrastructure'],
                    ],
                    'deliveryStatus' => 'partially_delivered',
                    'notes'          => 'Partial shipment: 4 docking stations delivered via BlueDart.',
                ])->render(),
            ],
        ];

        return response()->json($templates);
    }
}
