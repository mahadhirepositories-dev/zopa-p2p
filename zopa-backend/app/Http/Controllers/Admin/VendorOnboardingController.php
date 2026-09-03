<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\VendorOnboardingInviteMail;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Models\VendorAddress;
use App\Models\VendorCategory;
use App\Models\VendorDocument;
use App\Models\VendorFormTemplate;
use App\Models\VendorOnboardingAttachment;
use App\Models\VendorOnboardingInvite;
use App\Models\VendorOnboardingResponse;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class VendorOnboardingController extends Controller
{
    public function __construct(private ActivityLogService $actLog) {}

    /**
     * List onboarding invitations.
     */
    public function listInvites(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $query = VendorOnboardingInvite::with(['template:id,name,vendor_type', 'tenant:id,name', 'invitedBy:id,name'])
            ->withCount('response');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->search . '%';
            $query->where(function ($q) use ($search) {
                $q->where('vendor_name', 'like', $search)
                  ->orWhere('vendor_email', 'like', $search)
                  ->orWhere('phone', 'like', $search);
            });
        }

        $invites = $query->latest()->paginate($request->input('per_page', 25));

        // Append public URL to each invite
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $invites->getCollection()->transform(function ($inv) use ($frontendUrl) {
            $inv->onboarding_url = "{$frontendUrl}/vendor-onboarding/{$inv->token}";
            $inv->is_expired = $inv->isExpired();
            return $inv;
        });

        return response()->json($invites);
    }

    /**
     * Create and send a new vendor onboarding invitation with a single-use link.
     */
    public function sendInvite(Request $request): JsonResponse
    {
        $request->validate([
            'form_template_id' => 'required|integer|exists:vendor_form_templates,id',
            'vendor_email'     => 'required|email|max:150',
            'vendor_name'      => 'nullable|string|max:255',
            'phone'            => 'nullable|string|max:30',
            'expiry_days'      => 'nullable|integer|min:1|max:90',
            'tenant_id'        => 'nullable|integer|exists:tenants,id',
        ]);

        $tenantId = $request->tenant_id ?? $this->resolveTenantId($request);
        if (!$tenantId) {
            $tenantId = Tenant::first()->id;
        }

        $token = bin2hex(random_bytes(32));
        $expiryDays = (int) ($request->expiry_days ?? 7);

        $invite = VendorOnboardingInvite::create([
            'tenant_id'        => $tenantId,
            'form_template_id' => $request->form_template_id,
            'token'            => $token,
            'vendor_name'      => $request->vendor_name,
            'vendor_email'     => strtolower(trim($request->vendor_email)),
            'phone'            => $request->phone,
            'status'           => 'pending',
            'expires_at'       => now()->addDays($expiryDays),
            'invited_by'       => auth()->id(),
        ]);

        // Dispatch invitation email
        try {
            Mail::to($invite->vendor_email)->queue(new VendorOnboardingInviteMail($invite));
        } catch (\Throwable $e) {
            \Log::warning("Failed to queue vendor onboarding email to {$invite->vendor_email}: " . $e->getMessage());
        }

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $invite->onboarding_url = "{$frontendUrl}/vendor-onboarding/{$invite->token}";

        return response()->json($invite->load('template', 'tenant'), 201);
    }

    /**
     * Resend an invite (extends expiry and sends fresh email).
     */
    public function resendInvite(Request $request, int $id): JsonResponse
    {
        $invite = VendorOnboardingInvite::findOrFail($id);

        if ($invite->isSubmitted()) {
            return response()->json(['error' => 'This invitation has already been submitted and cannot be resent.'], 422);
        }

        $expiryDays = (int) ($request->expiry_days ?? 7);
        $invite->update([
            'expires_at' => now()->addDays($expiryDays),
            'status'     => 'pending',
        ]);

        try {
            Mail::to($invite->vendor_email)->queue(new VendorOnboardingInviteMail($invite));
        } catch (\Throwable $e) {
            \Log::warning("Failed to queue resend email: " . $e->getMessage());
        }

        return response()->json(['message' => 'Invitation email resent successfully.']);
    }

    /**
     * List onboarding responses (Staging queue).
     */
    public function listResponses(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $query = VendorOnboardingResponse::with([
            'template:id,name,vendor_type',
            'tenant:id,name',
            'invite:id,token,vendor_email,phone,created_at',
            'vendor:id,name,global_vendor_code',
            'approvedBy:id,name',
            'rejectedBy:id,name',
            'attachments',
        ])->withCount('attachments');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('template_id')) {
            $query->where('form_template_id', $request->template_id);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->search . '%';
            $query->where(function ($q) use ($search) {
                $q->where('form_data->name', 'like', $search)
                  ->orWhere('form_data->email', 'like', $search)
                  ->orWhere('form_data->pan', 'like', $search)
                  ->orWhere('form_data->gstin', 'like', $search)
                  ->orWhere('form_data->phone', 'like', $search);
            });
        }

        $responses = $query->latest()->paginate($request->input('per_page', 25));

        return response()->json($responses);
    }

    /**
     * Show a single onboarding response with all attachments and parsed fields.
     */
    public function showResponse(int $id): JsonResponse
    {
        $response = VendorOnboardingResponse::with([
            'template',
            'tenant',
            'invite',
            'attachments',
            'vendor',
            'approvedBy:id,name',
            'rejectedBy:id,name',
        ])->findOrFail($id);

        return response()->json($response);
    }

    /**
     * Approve and promote onboarding response directly into P2P Vendor Directory!
     * Ensures all dependencies (codes, addresses, bank, documents, categories) are met.
     */
    public function approveAndPromote(Request $request, int $id): JsonResponse
    {
        $response = VendorOnboardingResponse::with(['attachments', 'invite'])->findOrFail($id);

        if ($response->status === 'approved') {
            return response()->json(['error' => 'This vendor response has already been approved.'], 422);
        }

        $tenantId = $response->tenant_id;
        $formData = $response->form_data ?? [];

        // Allow reviewer to override or complement mapped values
        $name        = trim($request->input('name', $formData['name'] ?? ''));
        $pan         = strtoupper(trim($request->input('pan', $formData['pan'] ?? '')));
        $gstin       = strtoupper(trim($request->input('gstin', $formData['gstin'] ?? '')));
        $email       = strtolower(trim($request->input('email', $formData['email'] ?? $response->invite?->vendor_email ?? '')));
        $phone       = trim($request->input('phone', $formData['phone'] ?? $response->invite?->phone ?? ''));
        $vendorType  = $request->input('vendor_type', $formData['vendor_type'] ?? 'distributor');
        $entityType  = $request->input('entity_type', $formData['entity_type'] ?? 'pvt_ltd');
        $currency    = $request->input('currency', $formData['currency'] ?? 'INR');
        $specialStatus = $request->input('special_status', $formData['special_status'] ?? 'non_msme');

        // Bank details
        $accountNo   = $request->input('account_no', $formData['account_no'] ?? null);
        $ifsc        = strtoupper(trim($request->input('ifsc', $formData['ifsc'] ?? '')));
        $bankName    = $request->input('bank_name', $formData['bank_name'] ?? null);
        $branchName  = $request->input('branch_name', $formData['branch_name'] ?? null);

        // Address details
        $address     = $request->input('address', $formData['address'] ?? '');
        $city        = $request->input('city', $formData['city'] ?? '');
        $state       = $request->input('state', $formData['state'] ?? '');
        $pincode     = $request->input('pincode', $formData['pincode'] ?? '');
        $stateCode   = $request->input('state_code', '');

        if (empty($name)) {
            return response()->json(['error' => 'Vendor Name is required to promote to P2P.'], 422);
        }

        // Validate uniqueness within this tenant
        if (!empty($pan)) {
            $existingPan = Vendor::where('tenant_id', $tenantId)->where('pan', $pan)->first();
            if ($existingPan) {
                return response()->json(['error' => "A vendor with PAN {$pan} already exists in this organization ({$existingPan->name} - {$existingPan->global_vendor_code})."], 422);
            }
        }

        if (!empty($gstin)) {
            $existingGst = Vendor::where('tenant_id', $tenantId)->where('gstin', $gstin)->first();
            if ($existingGst) {
                return response()->json(['error' => "A vendor with GSTIN {$gstin} already exists in this organization ({$existingGst->name} - {$existingGst->global_vendor_code})."], 422);
            }
        }

        $vendor = DB::transaction(function () use (
            $response, $tenantId, $name, $pan, $gstin, $email, $phone,
            $vendorType, $entityType, $currency, $specialStatus,
            $accountNo, $ifsc, $bankName, $branchName,
            $address, $city, $state, $pincode, $stateCode, $request
        ) {
            // 1. Generate sequential global_vendor_code: ZP-YYMM-XX
            $prefix = 'ZP-' . date('y') . date('m') . '-';
            do {
                $maxSeq = Vendor::where('tenant_id', $tenantId)
                    ->where('global_vendor_code', 'like', $prefix . '%')
                    ->get()
                    ->map(fn($v) => (int) str_replace($prefix, '', $v->global_vendor_code))
                    ->max() ?? 0;
                $code = $prefix . str_pad($maxSeq + 1, 2, '0', STR_PAD_LEFT);
            } while (Vendor::where('tenant_id', $tenantId)->where('global_vendor_code', $code)->exists());

            // 2. Create Vendor
            $vendor = Vendor::create([
                'tenant_id'          => $tenantId,
                'name'               => $name,
                'global_vendor_code' => $code,
                'vendor_type'        => $vendorType,
                'entity_type'        => $entityType,
                'pan'                => !empty($pan) ? $pan : null,
                'pan_not_available'  => empty($pan),
                'gstin'              => !empty($gstin) ? $gstin : null,
                'gst_status'         => !empty($gstin) ? 'registered' : 'unregistered',
                'email'              => !empty($email) ? $email : null,
                'phone'              => !empty($phone) ? $phone : null,
                'currency'           => $currency,
                'special_status'     => !empty($specialStatus) ? $specialStatus : null,
                'account_no'         => !empty($accountNo) ? $accountNo : null,
                'ifsc'               => !empty($ifsc) ? $ifsc : null,
                'bank_name'          => !empty($bankName) ? $bankName : null,
                'branch_name'        => !empty($branchName) ? $branchName : null,
                'is_active'          => true,
            ]);

            // 3. Create Default Address if provided
            if (!empty($address) || !empty($city)) {
                VendorAddress::create([
                    'vendor_id'     => $vendor->id,
                    'label'         => 'Registered Office',
                    'address'       => $address ?: '—',
                    'city'          => $city ?: '—',
                    'state'         => $state ?: '—',
                    'pincode'       => $pincode ?: '—',
                    'state_code'    => $stateCode ?: (strlen($gstin) >= 2 ? substr($gstin, 0, 2) : ''),
                    'country'       => 'India',
                    'gstin'         => !empty($gstin) ? $gstin : null,
                    'contact_name'  => $name,
                    'contact_phone' => $phone,
                    'is_default'    => true,
                ]);
            }

            // 4. Archive attachments into Vendor Documents
            foreach ($response->attachments as $att) {
                if (Storage::disk('public')->exists($att->file_path)) {
                    $newPath = "vendors/{$vendor->id}/documents/{$att->file_name}";
                    Storage::disk('public')->copy($att->file_path, $newPath);

                    $docType = $att->document_type;
                    if (!in_array($docType, ['pan', 'gst', 'cancelled_cheque', 'additional'])) {
                        $docType = 'additional';
                    }

                    VendorDocument::create([
                        'vendor_id'     => $vendor->id,
                        'document_type' => $docType,
                        'file_name'     => $att->file_name,
                        'original_name' => $att->original_name,
                        'file_path'     => $newPath,
                        'size'          => $att->size,
                        'uploaded_by'   => auth()->id(),
                    ]);
                }
            }

            // 5. Link categories if provided
            if ($request->has('category_ids') && is_array($request->category_ids)) {
                foreach ($request->category_ids as $catId) {
                    VendorCategory::create([
                        'vendor_id'   => $vendor->id,
                        'category_id' => $catId,
                    ]);
                }
            }

            // 6. Update response record
            $response->update([
                'status'            => 'approved',
                'admin_notes'       => $request->input('notes', 'Approved and added to P2P vendor pool.'),
                'approved_by'       => auth()->id(),
                'approved_at'       => now(),
                'created_vendor_id' => $vendor->id,
            ]);

            // 7. Audit log
            $this->actLog->log('VENDOR', $vendor->id, 'created_from_onboarding', [
                'response_id' => $response->id,
                'name'        => $vendor->name,
                'code'        => $vendor->global_vendor_code,
            ]);

            return $vendor;
        });

        return response()->json([
            'message' => "Vendor {$vendor->name} successfully approved and added to P2P with Vendor Code: {$vendor->global_vendor_code}!",
            'vendor'  => $vendor->load('addresses', 'documents'),
        ]);
    }

    /**
     * Reject an onboarding response.
     */
    public function rejectResponse(Request $request, int $id): JsonResponse
    {
        $response = VendorOnboardingResponse::findOrFail($id);

        if ($response->status === 'approved') {
            return response()->json(['error' => 'An already approved vendor response cannot be rejected.'], 422);
        }

        $request->validate(['notes' => 'required|string|max:1000']);

        $response->update([
            'status'      => 'rejected',
            'admin_notes' => $request->notes,
            'rejected_by' => auth()->id(),
            'rejected_at' => now(),
        ]);

        return response()->json(['message' => 'Onboarding response marked as rejected.']);
    }

    /**
     * Download or view response attachment securely.
     */
    public function downloadAttachment(Request $request, int $id, int $attachmentId)
    {
        $response = VendorOnboardingResponse::findOrFail($id);
        $attachment = $response->attachments()->findOrFail($attachmentId);

        abort_if(!Storage::disk('public')->exists($attachment->file_path), 404, 'File not found on server.');

        $fullPath = Storage::disk('public')->path($attachment->file_path);

        if ($request->boolean('inline', true)) {
            $mime = $attachment->mime_type ?: (file_exists($fullPath) ? mime_content_type($fullPath) : 'application/octet-stream');
            return response()->file($fullPath, [
                'Content-Type'        => $mime,
                'Content-Disposition' => 'inline; filename="' . $attachment->original_name . '"',
            ]);
        }

        return response()->download($fullPath, $attachment->original_name);
    }

    private function resolveTenantId(Request $request): ?int
    {
        if ($request->filled('tenant_id')) {
            return (int) $request->tenant_id;
        }

        if (app()->bound('currentTenant')) {
            return (int) app('currentTenant')->id;
        }

        return null;
    }
}
