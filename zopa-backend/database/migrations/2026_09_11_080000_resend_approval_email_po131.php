<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
        // 1. Ensure fonts directory exists
        $fontDir = storage_path('fonts');
        if (!file_exists($fontDir)) {
            @mkdir($fontDir, 0775, true);
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
            Log::warning('[Migration] Could not find Approval record for PO #131.');
            return;
        }

        // 3. Test PDF generation directly to ensure wkhtmltopdf / DomPDF works cleanly
        $po = PurchaseOrder::with([
            'items.product', 'vendor', 'vendorAddress',
            'costCenter.department', 'costCenter.project', 'costCenter.location',
            'approvals.assignedTo', 'billToLocation', 'shipToLocation', 'tenant',
            'creator', 'approver',
        ])->find(131);

        if ($po) {
            try {
                $pdfBytes = PdfService::makePoPdf($po);
                Log::info('[Migration] Successfully generated PO #131 PDF with engine: ' . PdfService::$lastEngineUsed . ' (bytes: ' . strlen($pdfBytes) . ')');
            } catch (\Throwable $e) {
                Log::error('[Migration] Failed generating PDF for PO #131 during migration: ' . $e->getMessage());
            }
        }

        // 4. Trigger email resend via ApprovalService
        try {
            $service = app(ApprovalService::class);
            $sent = $service->resendApprovalEmail($approvalModel);
            if ($sent) {
                Log::info("[Migration] Successfully dispatched approval email for PO #131 / Approval #{$approvalModel->id} to {$approvalModel->assignedTo?->email}");
            } else {
                Log::warning("[Migration] ApprovalService::resendApprovalEmail returned false for Approval #{$approvalModel->id}");
            }
        } catch (\Throwable $e) {
            Log::error("[Migration] Error resending approval email for PO #131: " . $e->getMessage(), [
                'exception' => $e,
            ]);
        }
    }

    public function down(): void
    {
        // No-op
    }
};
