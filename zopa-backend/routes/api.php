<?php

use App\Http\Controllers\ApprovalConfigController;
use App\Http\Controllers\PincodeController;
use App\Http\Controllers\PublicApprovalController;
use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\BoqController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\CostCenterController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExecutiveDashboardController;
use App\Http\Controllers\GrnController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\Master\CategoryController;
use App\Http\Controllers\Master\OrgController;
use App\Http\Controllers\Master\ProductController;
use App\Http\Controllers\Master\VendorController;
use App\Http\Controllers\AiController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseRequisitionController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\ClientController;
use App\Http\Controllers\Admin\ClientUserController;
use App\Http\Controllers\Admin\ZopaStaffController;
use App\Http\Controllers\Admin\PlatformSettingsController;
use App\Http\Controllers\Admin\RolePermissionsController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\EmailTemplatesController;
use App\Http\Middleware\TenantScopeMiddleware;
use Illuminate\Support\Facades\Route;

// Public — login is rate-limited (brute-force protection): 6 attempts/min per IP.
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

// TEMP DEBUG — remove after diagnosis
Route::get('/debug-pdf-engine', function () {
    $binary = config('snappy.pdf.binary', '/usr/bin/wkhtmltopdf');
    $exists = file_exists($binary);
    $executable = is_executable($binary);
    exec('test -x ' . escapeshellarg($binary) . ' 2>/dev/null', $out, $code);
    $testX = $code === 0;

    $version = null;
    exec(escapeshellarg($binary) . ' --version 2>&1', $vOut, $vCode);
    $version = implode(' ', $vOut);

    // Try generating a minimal 2-page PDF
    $html = '<html><body><p style="page-break-after:always">Page 1</p><p>Page 2</p></body></html>';
    $tmpIn  = sys_get_temp_dir() . '/dbg_in_'.uniqid().'.html';
    $tmpOut = sys_get_temp_dir() . '/dbg_out_'.uniqid().'.pdf';
    file_put_contents($tmpIn, $html);
    exec(escapeshellarg($binary) . ' --header-right "PO No: TEST" --margin-top 15 ' . escapeshellarg($tmpIn) . ' ' . escapeshellarg($tmpOut) . ' 2>&1', $pdfOut, $pdfCode);
    $pdfSize = file_exists($tmpOut) ? filesize($tmpOut) : 0;
    @unlink($tmpIn); @unlink($tmpOut);

    return response()->json([
        'binary'      => $binary,
        'exists'      => $exists,
        'executable'  => $executable,
        'test_x'      => $testX,
        'version'     => $version,
        'pdf_exit'    => $pdfCode,
        'pdf_output'  => $pdfOut,
        'pdf_size'    => $pdfSize,
        'php_os'      => PHP_OS_FAMILY,
        'snappy_cfg'  => config('snappy.pdf'),
    ]);
});

// Public password reset (rate-limited). forgot-password emails a one-time link;
// reset-password completes it with the emailed token.
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/auth/reset-password',  [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');

// Unauthenticated one-time-token PDF download (token issued by authenticated pdfUrl endpoint)
// Uses a plain integer {id} — NO route-model binding — so no middleware or global scope can fire.
Route::get('/po-pdf/{id}', [PurchaseOrderController::class, 'pdfByToken'])->where('id', '[0-9]+');

// GRN PDF via one-time token
Route::get('/grn-pdf/{id}', function ($id, \Illuminate\Http\Request $request) {
    $token = $request->query('token');
    $cachedId = \Illuminate\Support\Facades\Cache::get("grn_pdf_tkn_{$token}");
    abort_if(!$cachedId || (int) $cachedId !== (int) $id, 403, 'Invalid or expired token.');
    \Illuminate\Support\Facades\Cache::forget("grn_pdf_tkn_{$token}");

    $grn = \App\Models\Grn::with([
        'items.poItem.product',
        'purchaseOrder.vendor', 'purchaseOrder.tenant',
        'purchaseOrder.billToLocation', 'purchaseOrder.shipToLocation',
        'receivedBy',
    ])->findOrFail($id);

    $bytes  = \App\Services\PdfService::makeGrnPdf($grn);
    $safeNo = str_replace(['/', '\\'], '-', (string) ($grn->grn_number ?: $grn->id));

    return response($bytes, 200, [
        'Content-Type'        => 'application/pdf',
        'Content-Disposition' => 'inline; filename="GRN-' . $safeNo . '.pdf"',
    ]);
})->where('id', '[0-9]+');

// Pincode lookup — auth only, no tenant scope needed
Route::middleware('auth:sanctum')->get('/pincode/{pincode}', [PincodeController::class, 'lookup']);

// ── Public one-click email approval (token-authorized, NO login) ──────────────
// The unguessable single-use token in the URL is the authorization. Throttled
// as defence-in-depth against token guessing. Renders friendly HTML pages.
Route::middleware('throttle:30,1')->group(function () {
    // Approve is two-step (GET confirmation page → POST) so email security scanners /
    // link prefetchers that auto-fetch URLs on GET cannot silently approve.
    Route::get('/email/approval/{token}/approve',  [PublicApprovalController::class, 'showApprove'])->where('token', '[A-Za-z0-9]+');
    Route::post('/email/approval/{token}/approve', [PublicApprovalController::class, 'approve'])->where('token', '[A-Za-z0-9]+');
    Route::get('/email/approval/{token}/reject',   [PublicApprovalController::class, 'showReject'])->where('token', '[A-Za-z0-9]+');
    Route::post('/email/approval/{token}/reject',  [PublicApprovalController::class, 'reject'])->where('token', '[A-Za-z0-9]+');
});

// Authenticated (no tenant scope)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Self-service profile (any authenticated user, no tenant scope)
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::put('/auth/password', [AuthController::class, 'changePassword']);

    // Email approval action (token-based, no tenant scope)
    Route::post('/approvals/email-action', [ApprovalController::class, 'emailAction']);

    // Role permissions matrix — any authenticated user needs this to power canDo() checks.
    // Returns {role: {module: {can_view, can_create, can_edit, can_delete}}} for all roles.
    Route::get('/role-permissions', [RolePermissionsController::class, 'matrix']);

    // Get all available roles (used by Access Control, ZOPA Staff, and Org Staff)
    Route::get('/roles', [RoleController::class, 'index']);

    // Admin routes (Super Admin only)
    Route::prefix('admin')->middleware(['super_admin'])->group(function () {
        Route::get('zopa-staff', [ZopaStaffController::class, 'index']);
        Route::post('zopa-staff', [ZopaStaffController::class, 'store']);
        Route::delete('zopa-staff/{user}', [ZopaStaffController::class, 'destroy']);
        
        Route::get('clients', [ClientController::class, 'index']);
        Route::post('clients', [ClientController::class, 'store']);
        Route::get('clients/{id}', [ClientController::class, 'show']);
        Route::put('clients/{id}', [ClientController::class, 'update']);
        Route::post('clients/{id}/logo', [ClientController::class, 'uploadLogo']);

        // Platform (parent company / ZOPA branding) settings
        Route::get('settings',              [PlatformSettingsController::class, 'show']);
        Route::post('settings/logo',        [PlatformSettingsController::class, 'uploadLogo']);
        Route::delete('settings/logo',      [PlatformSettingsController::class, 'removeLogo']);
        
        // Admin dashboard (consolidated + per-tenant)
        Route::get('dashboard/stats', [AdminDashboardController::class, 'stats']);
        Route::get('dashboard/tenants', [AdminDashboardController::class, 'tenants']);
        Route::get('dashboard/export', [AdminDashboardController::class, 'export']);

        // Access Control — role × module permission matrix management
        Route::get('role-permissions', [RolePermissionsController::class, 'index']);
        Route::put('role-permissions/{role}', [RolePermissionsController::class, 'update']);

        // Roles Master
        Route::get('roles', [RoleController::class, 'index']);
        Route::post('roles', [RoleController::class, 'store']);
        Route::put('roles/{id}', [RoleController::class, 'update']);
        Route::delete('roles/{id}', [RoleController::class, 'destroy']);

        // Email templates — read-only preview catalogue
        Route::get('email-templates', [EmailTemplatesController::class, 'index']);

        Route::get('clients/{tenant}/users', [ClientUserController::class, 'index']);
        Route::post('clients/{tenant}/users', [ClientUserController::class, 'store']);
        Route::post('clients/{tenant}/assign-staff', [ClientUserController::class, 'assignStaff']);
        Route::put('clients/{tenant}/users/{user}/role', [ClientUserController::class, 'updateRole']);
        Route::delete('clients/{tenant}/users/{user}', [ClientUserController::class, 'destroy']);
    });

    // Tenant-scoped routes
    Route::middleware(TenantScopeMiddleware::class)->group(function () {

        // Dashboard
        Route::get('dashboard/stats', [DashboardController::class, 'stats']);
        Route::get('executive-dashboard/stats', [ExecutiveDashboardController::class, 'stats']);
        Route::get('executive-dashboard/export', [ExecutiveDashboardController::class, 'export']);

        // Org master data
        Route::get('departments', [OrgController::class, 'departments']);
        Route::post('departments', [OrgController::class, 'storeDepartment']);
        Route::put('departments/{department}', [OrgController::class, 'updateDepartment']);
        Route::delete('departments/{department}', [OrgController::class, 'destroyDepartment']);

        Route::get('projects', [OrgController::class, 'projects']);
        Route::post('projects', [OrgController::class, 'storeProject']);
        Route::put('projects/{project}', [OrgController::class, 'updateProject']);
        Route::delete('projects/{project}', [OrgController::class, 'destroyProject']);

        Route::get('locations', [OrgController::class, 'locations']);
        Route::post('locations', [OrgController::class, 'storeLocation']);
        Route::put('locations/{location}', [OrgController::class, 'updateLocation']);
        Route::delete('locations/{location}', [OrgController::class, 'destroyLocation']);

        // Tenant users — list, create, deactivate
        Route::get('users', [UserController::class, 'tenantUsers']);
        Route::post('users', [UserController::class, 'store']);
        Route::delete('users/{userId}', [UserController::class, 'destroy']);

        // Vendors
        // Bulk upload routes MUST come before apiResource so /template & /import
        // aren't captured by the {vendor} wildcard.
        Route::get('vendors/export', [VendorController::class, 'export']);
        Route::get('vendors/template', [VendorController::class, 'template']);
        Route::post('vendors/import', [VendorController::class, 'import']);
        Route::get('vendors/{vendor}/pdf-url', [VendorController::class, 'pdfUrl']);
        Route::get('vendors/{vendor}/pdf', [VendorController::class, 'pdf']);
        Route::apiResource('vendors', VendorController::class);
        Route::get('vendors/{vendor}/activity', [VendorController::class, 'activity']);
        Route::get('vendors/{vendor}/addresses', [VendorController::class, 'addresses']);
        Route::post('vendors/{vendor}/addresses', [VendorController::class, 'storeAddress']);
        Route::put('vendors/{vendor}/addresses/{address}', [VendorController::class, 'updateAddress']);
        Route::delete('vendors/{vendor}/addresses/{address}', [VendorController::class, 'destroyAddress']);
        Route::post('vendors/{vendor}/documents', [VendorController::class, 'uploadDocument']);
        Route::delete('vendors/{vendor}/documents/{document}', [VendorController::class, 'deleteDocument']);

        // Categories & Products
        Route::get('categories/export', [CategoryController::class, 'export']);
        Route::apiResource('categories', CategoryController::class);
        // Bulk upload routes before apiResource so /template & /import aren't
        // captured by the {product} wildcard.
        Route::get('products/export', [ProductController::class, 'export']);
        Route::get('products/template', [ProductController::class, 'template']);
        Route::post('products/import', [ProductController::class, 'import']);
        Route::apiResource('products', ProductController::class);

        // Cost Centers & Budget
        Route::apiResource('cost-centers', CostCenterController::class);
        Route::get('cost-centers/{costCenter}/budget', [CostCenterController::class, 'budget']);
        Route::get('cost-centers/{costCenter}/budget/ledger', [CostCenterController::class, 'budgetLedger']);
        Route::post('cost-centers/{costCenter}/budget/adjust', [CostCenterController::class, 'adjustBudget']);

        // Approval Configs per Cost Center
        Route::get('cost-centers/{costCenter}/approval-configs', [ApprovalConfigController::class, 'index']);
        Route::post('cost-centers/{costCenter}/approval-configs', [ApprovalConfigController::class, 'store']);
        Route::put('cost-centers/{costCenter}/approval-configs/{approvalConfig}', [ApprovalConfigController::class, 'update']);
        Route::delete('cost-centers/{costCenter}/approval-configs/{approvalConfig}', [ApprovalConfigController::class, 'destroy']);

        // AI
        Route::post('ai/suggest-terms', [AiController::class, 'suggestTerms']);

        // BOQ (line-item) bulk upload for PO / PR creation
        Route::get('boq/template', [BoqController::class, 'template']);
        Route::post('boq/parse', [BoqController::class, 'parse']);

        // Purchase Orders
        Route::get('purchase-orders/export', [PurchaseOrderController::class, 'export']);
        Route::apiResource('purchase-orders', PurchaseOrderController::class);
        Route::post('purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit']);
        Route::post('purchase-orders/{purchaseOrder}/release', [PurchaseOrderController::class, 'release']);
        Route::post('purchase-orders/{purchaseOrder}/send-to-vendor', [PurchaseOrderController::class, 'sendToVendor']);
        Route::post('purchase-orders/{purchaseOrder}/deliver', [PurchaseOrderController::class, 'deliver']);
        Route::post('purchase-orders/{purchaseOrder}/delivery-status', [PurchaseOrderController::class, 'markDeliveryStatus']);
        Route::post('purchase-orders/{purchaseOrder}/release-payment', [PurchaseOrderController::class, 'releasePayment']);
        Route::post('purchase-orders/{purchaseOrder}/reset-to-draft', [PurchaseOrderController::class, 'resetToDraft']);
        Route::get('purchase-orders/{purchaseOrder}/approval-diagnostic', [PurchaseOrderController::class, 'approvalDiagnostic']);


        Route::post('purchase-orders/{purchaseOrder}/upload', [PurchaseOrderController::class, 'upload']);
        Route::get('purchase-orders/{purchaseOrder}/pdf', [PurchaseOrderController::class, 'pdf']);
        Route::get('purchase-orders/{purchaseOrder}/pdf-url', [PurchaseOrderController::class, 'pdfUrl']);

        // Approvals
        Route::get('approvals/export', [ApprovalController::class, 'export']);
        Route::get('approvals/pending', [ApprovalController::class, 'pending']);
        Route::get('approvals/all-pending', [ApprovalController::class, 'allPending']); // admin read-only oversight
        Route::post('approvals/{approval}/approve', [ApprovalController::class, 'approve']);
        Route::post('approvals/{approval}/return', [ApprovalController::class, 'returnWithQuery']);
        Route::post('approvals/{approval}/reject', [ApprovalController::class, 'reject']);
        // PO-scoped approval actions — lets the approver act from the PO detail page
        Route::get('purchase-orders/{purchaseOrder}/my-approval', [ApprovalController::class, 'myApprovalForPo']);
        Route::post('purchase-orders/{purchaseOrder}/approve', [ApprovalController::class, 'approveViaPoId']);
        Route::post('purchase-orders/{purchaseOrder}/return', [ApprovalController::class, 'returnViaPoId']);
        Route::post('purchase-orders/{purchaseOrder}/reject-approval', [ApprovalController::class, 'rejectViaPoId']);

        // GRN
        Route::get('grns/export', [GrnController::class, 'export']);
        Route::get('grns', [GrnController::class, 'index']);
        Route::post('grns', [GrnController::class, 'store']);
        Route::get('grns/{grn}', [GrnController::class, 'show']);
        Route::put('grns/{grn}', [GrnController::class, 'update']);
        Route::get('grns/{grn}/pdf', [GrnController::class, 'pdf']);
        Route::get('grns/{grn}/pdf-url', [GrnController::class, 'pdfUrl']);
        Route::post('grns/{grn}/upload', [GrnController::class, 'upload']);
        Route::get('grns/{grn}/attachments/{attachment}', [GrnController::class, 'downloadAttachment']);
        Route::get('purchase-orders/{purchaseOrder}/grns', [GrnController::class, 'forPo']);

        // Invoices
        Route::get('invoices/export', [InvoiceController::class, 'export']);
        Route::get('invoices', [InvoiceController::class, 'index']);
        Route::post('invoices', [InvoiceController::class, 'store']);
        Route::get('invoices/{invoice}', [InvoiceController::class, 'show']);
        Route::put('invoices/{invoice}', [InvoiceController::class, 'update']);

        // Purchase Requisitions
        Route::get('purchase-requisitions/export', [PurchaseRequisitionController::class, 'export']);
        Route::delete('purchase-requisitions/cleanup-drafts', [PurchaseRequisitionController::class, 'cleanupDrafts']);
        Route::apiResource('purchase-requisitions', PurchaseRequisitionController::class);
        Route::post('purchase-requisitions/{purchaseRequisition}/submit', [PurchaseRequisitionController::class, 'submit']);
        Route::post('purchase-requisitions/{purchaseRequisition}/reject', [PurchaseRequisitionController::class, 'reject']);
        Route::post('purchase-requisitions/{purchaseRequisition}/short-close', [PurchaseRequisitionController::class, 'shortClose']);
        Route::post('purchase-requisitions/{purchaseRequisition}/rfq-create', [PurchaseRequisitionController::class, 'rfqCreate']);
        Route::post('purchase-requisitions/{purchaseRequisition}/request-clarification', [PurchaseRequisitionController::class, 'requestClarification']);
        Route::post('purchase-requisitions/{purchaseRequisition}/provide-clarification', [PurchaseRequisitionController::class, 'provideClarification']);
        Route::get('purchase-requisitions/{purchaseRequisition}/activities', [PurchaseRequisitionController::class, 'activities']);

        Route::get('purchase-orders/{purchaseOrder}/activities', [PurchaseOrderController::class, 'activities']);

        // Reports
        Route::get('reports/po-tat', [ReportController::class, 'poTat']);
    });
});

Route::get('/vendor-pdf/{id}', function (\Illuminate\Http\Request $request, $id) {
    $token = $request->query('token');
    $payload = $token ? \Cache::pull("pdf_dl_vendor_{$token}") : null;

    if (!$payload || (int) $payload['vendor_id'] !== (int) $id) {
        abort(403, 'Invalid or expired download token.');
    }

    $vendor = \App\Models\Vendor::findOrFail($id);
    abort_if((int) $vendor->tenant_id !== (int) $payload['tenant_id'], 403);

    $bytes = \App\Services\PdfService::makeVendorPdf($vendor);
    $safeCode = str_replace(['/', '\\'], '-', (string) ($vendor->global_vendor_code ?: $vendor->id));

    return response($bytes, 200, [
        'Content-Type'        => 'application/pdf',
        'Content-Disposition' => 'inline; filename="Vendor-' . $safeCode . '.pdf"',
    ]);
});
