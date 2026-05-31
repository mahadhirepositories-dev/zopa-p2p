<?php

use App\Http\Controllers\ApprovalConfigController;
use App\Http\Controllers\PincodeController;
use App\Http\Controllers\PublicApprovalController;
use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\CostCenterController;
use App\Http\Controllers\DashboardController;
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
use App\Http\Middleware\TenantScopeMiddleware;
use Illuminate\Support\Facades\Route;

// Public — login is rate-limited (brute-force protection): 6 attempts/min per IP.
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

// Unauthenticated one-time-token PDF download (token issued by authenticated pdfUrl endpoint)
// Uses a plain integer {id} — NO route-model binding — so no middleware or global scope can fire.
Route::get('/po-pdf/{id}', [PurchaseOrderController::class, 'pdfByToken'])->where('id', '[0-9]+');

// Pincode lookup — auth only, no tenant scope needed
Route::middleware('auth:sanctum')->get('/pincode/{pincode}', [PincodeController::class, 'lookup']);

// ── Public one-click email approval (token-authorized, NO login) ──────────────
// The unguessable single-use token in the URL is the authorization. Throttled
// as defence-in-depth against token guessing. Renders friendly HTML pages.
Route::middleware('throttle:30,1')->group(function () {
    Route::get('/email/approval/{token}/approve', [PublicApprovalController::class, 'approve'])->where('token', '[A-Za-z0-9]+');
    Route::get('/email/approval/{token}/reject',  [PublicApprovalController::class, 'showReject'])->where('token', '[A-Za-z0-9]+');
    Route::post('/email/approval/{token}/reject', [PublicApprovalController::class, 'reject'])->where('token', '[A-Za-z0-9]+');
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

        // Access Control — role × module permission matrix management
        Route::get('role-permissions', [RolePermissionsController::class, 'index']);
        Route::put('role-permissions/{role}', [RolePermissionsController::class, 'update']);

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
        Route::apiResource('vendors', VendorController::class);
        Route::get('vendors/{vendor}/addresses', [VendorController::class, 'addresses']);
        Route::post('vendors/{vendor}/addresses', [VendorController::class, 'storeAddress']);
        Route::put('vendors/{vendor}/addresses/{address}', [VendorController::class, 'updateAddress']);
        Route::delete('vendors/{vendor}/addresses/{address}', [VendorController::class, 'destroyAddress']);
        Route::post('vendors/{vendor}/documents', [VendorController::class, 'uploadDocument']);
        Route::delete('vendors/{vendor}/documents/{document}', [VendorController::class, 'deleteDocument']);

        // Categories & Products
        Route::apiResource('categories', CategoryController::class);
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

        // Purchase Orders
        Route::apiResource('purchase-orders', PurchaseOrderController::class);
        Route::post('purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit']);
        Route::post('purchase-orders/{purchaseOrder}/release', [PurchaseOrderController::class, 'release']);
        Route::post('purchase-orders/{purchaseOrder}/deliver', [PurchaseOrderController::class, 'deliver']);
        Route::post('purchase-orders/{purchaseOrder}/release-payment', [PurchaseOrderController::class, 'releasePayment']);
        Route::post('purchase-orders/{purchaseOrder}/upload', [PurchaseOrderController::class, 'upload']);
        Route::get('purchase-orders/{purchaseOrder}/pdf', [PurchaseOrderController::class, 'pdf']);
        Route::get('purchase-orders/{purchaseOrder}/pdf-url', [PurchaseOrderController::class, 'pdfUrl']);

        // Approvals
        Route::get('approvals/pending', [ApprovalController::class, 'pending']);
        Route::post('approvals/{approval}/approve', [ApprovalController::class, 'approve']);
        Route::post('approvals/{approval}/return', [ApprovalController::class, 'returnWithQuery']);
        Route::post('approvals/{approval}/reject', [ApprovalController::class, 'reject']);

        // GRN
        Route::get('grns', [GrnController::class, 'index']);
        Route::post('grns', [GrnController::class, 'store']);
        Route::get('grns/{grn}', [GrnController::class, 'show']);
        Route::get('purchase-orders/{purchaseOrder}/grns', [GrnController::class, 'forPo']);

        // Invoices
        Route::get('invoices', [InvoiceController::class, 'index']);
        Route::post('invoices', [InvoiceController::class, 'store']);
        Route::get('invoices/{invoice}', [InvoiceController::class, 'show']);
        Route::put('invoices/{invoice}', [InvoiceController::class, 'update']);

        // Purchase Requisitions
        Route::apiResource('purchase-requisitions', PurchaseRequisitionController::class);
        Route::post('purchase-requisitions/{purchaseRequisition}/submit', [PurchaseRequisitionController::class, 'submit']);
        Route::post('purchase-requisitions/{purchaseRequisition}/reject', [PurchaseRequisitionController::class, 'reject']);
        Route::post('purchase-requisitions/{purchaseRequisition}/rfq-create', [PurchaseRequisitionController::class, 'rfqCreate']);
        Route::post('purchase-requisitions/{purchaseRequisition}/rfq-approve', [PurchaseRequisitionController::class, 'rfqApprove']);
        Route::get('purchase-requisitions/{purchaseRequisition}/activities', [PurchaseRequisitionController::class, 'activities']);
        Route::get('purchase-orders/{purchaseOrder}/activities', [PurchaseOrderController::class, 'activities']);

        // Reports
        Route::get('reports/po-tat', [ReportController::class, 'poTat']);
    });
});
