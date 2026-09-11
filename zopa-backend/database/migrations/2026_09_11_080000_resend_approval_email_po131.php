<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\Approval;
use App\Models\PurchaseOrder;
use App\Services\ApprovalService;
use App\Services\PdfService;

return new class extends Migration
{
    /**
     * Resend approval email with PO PDF attachment for PO #131 (Approval #126).
     * This ensures the approver and buyer receive the email immediately during deploy.
     */
    public function up(): void
    {
        // 1. Ensure fonts and logs directories exist and are writable
        $fontDir = storage_path('fonts');
        if (!file_exists($fontDir)) {
            @mkdir($fontDir, 0777, true);
        }
        @chmod($fontDir, 0777);

        $logDir = storage_path('logs');
        if (!file_exists($logDir)) {
            @mkdir($logDir, 0777, true);
        }
        @chmod($logDir, 0777);
        $logFile = storage_path('logs/laravel.log');
        if (file_exists($logFile)) {
            @chmod($logFile, 0666);
        }

        // 2. Find Approval for PO 131
        $approvalModel = Approval::where('entity_type', 'PO')
            ->where('entity_id', 131)
            ->where('action', 'pending')
            ->first();

        if (!$approvalModel) {
            $approvalModel = Approval::where('entity_type', 'PO')
                ->where('entity_id', 131)
                ->latest()
                ->first();
        }

        if (!$approvalModel) {
            echo "Notice: Could not find Approval record for PO #131.\n";
            return;
        }

        // 3. Test PO and PDF generation directly
        $po = PurchaseOrder::with([
            'items.product', 'vendor', 'vendorAddress',
            'costCenter.department', 'costCenter.project', 'costCenter.location',
            'approvals.assignedTo', 'billToLocation', 'shipToLocation', 'tenant',
            'creator', 'approver',
        ])->find(131);

        if ($po) {
            try {
                $pdfBytes = PdfService::makePoPdf($po);
                echo "PO #131 PDF generated successfully (" . strlen($pdfBytes) . " bytes, engine: " . PdfService::$lastEngineUsed . ")\n";
            } catch (\Throwable $e) {
                echo "Warning: PDF generation encountered: " . $e->getMessage() . "\n";
            }
        }

        // 4. Trigger email resend via ApprovalService
        try {
            $service = app(ApprovalService::class);
            $sent = $service->resendApprovalEmail($approvalModel);
            if ($sent) {
                echo "Approval email dispatched successfully for PO #131 to " . ($approvalModel->assignedTo?->email ?? 'approver') . "\n";
            } else {
                echo "Notice: ApprovalService::resendApprovalEmail returned false.\n";
            }
        } catch (\Throwable $e) {
            echo "Error during email dispatch: " . $e->getMessage() . "\n";
        }
    }

    public function down(): void
    {
        // No-op
    }
};
