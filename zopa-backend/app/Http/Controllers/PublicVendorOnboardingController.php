<?php

namespace App\Http\Controllers;

use App\Mail\VendorOnboardingSubmittedMail;
use App\Models\User;
use App\Models\VendorOnboardingAttachment;
use App\Models\VendorOnboardingInvite;
use App\Models\VendorOnboardingResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PublicVendorOnboardingController extends Controller
{
    /**
     * Publicly retrieve the onboarding form for a vendor using a one-time token.
     */
    public function getForm(string $token): JsonResponse
    {
        $invite = VendorOnboardingInvite::with(['template', 'tenant:id,name,code'])
            ->where('token', $token)
            ->first();

        if (!$invite) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'The onboarding link you followed is invalid or does not exist.'
            ], 404);
        }

        if ($invite->isSubmitted()) {
            return response()->json([
                'error'        => 'already_submitted',
                'message'      => 'This onboarding registration form has already been completed and submitted. Single-use links can only be filled once.',
                'submitted_at' => $invite->submitted_at?->format('d M Y, h:i A'),
                'vendor_name'  => $invite->vendor_name,
            ], 410);
        }

        if ($invite->isExpired()) {
            return response()->json([
                'error'      => 'expired',
                'message'    => 'This onboarding link has expired. Please contact the procurement department to request a new registration link.',
                'expires_at' => $invite->expires_at->format('d M Y, h:i A'),
            ], 410);
        }

        return response()->json([
            'status'       => 'active',
            'token'        => $invite->token,
            'vendor_name'  => $invite->vendor_name,
            'vendor_email' => $invite->vendor_email,
            'phone'        => $invite->phone,
            'expires_at'   => $invite->expires_at->format('d M Y, h:i A'),
            'tenant'       => [
                'name' => $invite->tenant?->name ?? 'ZOPA Procurement',
                'code' => $invite->tenant?->code ?? 'ZOPA',
            ],
            'template'     => [
                'id'                => $invite->template?->id,
                'name'              => $invite->template?->name,
                'description'       => $invite->template?->description,
                'schema_definition' => $invite->template?->schema_definition ?? [],
            ],
        ]);
    }

    /**
     * Submit vendor response and upload documents.
     * Guaranteed single-use: atomically transitions token to 'submitted' so it cannot be reused.
     */
    public function submit(Request $request, string $token): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $token) {
            $invite = VendorOnboardingInvite::with('template', 'tenant')
                ->where('token', $token)
                ->lockForUpdate()
                ->first();

            if (!$invite) {
                return ['status' => 404, 'data' => ['error' => 'not_found', 'message' => 'Invalid onboarding token.']];
            }

            if ($invite->isSubmitted()) {
                return [
                    'status' => 410,
                    'data'   => [
                        'error'   => 'already_submitted',
                        'message' => 'This onboarding registration form has already been submitted and cannot be submitted again.'
                    ]
                ];
            }

            if ($invite->isExpired()) {
                return [
                    'status' => 410,
                    'data'   => [
                        'error'   => 'expired',
                        'message' => 'This onboarding link has expired.'
                    ]
                ];
            }

            $schema = $invite->template?->schema_definition ?? [];
            $formData = [];
            $attachmentsToSave = [];

            // Parse text/select/numeric fields
            foreach ($schema as $field) {
                $key = $field['field_key'];
                $type = $field['type'] ?? 'text';
                $required = !empty($field['required']);

                if ($type === 'file') {
                    // Check file upload
                    if ($request->hasFile($key)) {
                        $file = $request->file($key);
                        $attachmentsToSave[] = [
                            'field_key'     => $key,
                            'document_type' => $field['target_doc_type'] ?? 'additional',
                            'file'          => $file,
                        ];
                        $formData[$key] = $file->getClientOriginalName();
                    } elseif ($required) {
                        return [
                            'status' => 422,
                            'data'   => ['error' => 'validation', 'message' => "The document '{$field['label']}' is required."]
                        ];
                    }
                } else {
                    $val = $request->input($key);
                    if ($type === 'multiselect') {
                        if (is_string($val)) {
                            $decoded = json_decode($val, true);
                            if (is_array($decoded)) {
                                $val = $decoded;
                            } elseif (str_contains($val, ',')) {
                                $val = array_map('trim', explode(',', $val));
                            }
                        }
                    }
                    if ($required && (is_null($val) || $val === '' || (is_array($val) && empty($val)))) {
                        return [
                            'status' => 422,
                            'data'   => ['error' => 'validation', 'message' => "The field '{$field['label']}' is required."]
                        ];
                    }
                    $formData[$key] = $val;
                }
            }

            // Also fallback for standard top-level fields if passed
            if (!empty($request->name) && empty($formData['name'])) $formData['name'] = $request->name;
            if (!empty($request->email) && empty($formData['email'])) $formData['email'] = $request->email;
            if (!empty($request->phone) && empty($formData['phone'])) $formData['phone'] = $request->phone;

            // 1. Create response record
            $response = VendorOnboardingResponse::create([
                'invite_id'        => $invite->id,
                'tenant_id'        => $invite->tenant_id,
                'form_template_id' => $invite->form_template_id,
                'form_snapshot'    => $schema,
                'form_data'        => $formData,
                'status'           => 'pending_review',
            ]);

            // 2. Save attachments to storage and database
            foreach ($attachmentsToSave as $item) {
                $file = $item['file'];
                $origName = $file->getClientOriginalName();
                $cleanName = Str::slug(pathinfo($origName, PATHINFO_FILENAME)) . '_' . Str::random(8) . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs("onboarding/{$response->id}", $cleanName, 'public');

                VendorOnboardingAttachment::create([
                    'response_id'   => $response->id,
                    'field_key'     => $item['field_key'],
                    'document_type' => $item['document_type'],
                    'file_name'     => $cleanName,
                    'original_name' => $origName,
                    'file_path'     => $path,
                    'mime_type'     => $file->getMimeType(),
                    'size'          => $file->getSize(),
                ]);
            }

            // 3. Mark invite as submitted (single-use lock)
            $invite->update([
                'status'       => 'submitted',
                'submitted_at' => now(),
            ]);

            // 4. Notify admin / procurement team via email
            $this->notifyAdmins($response, $invite);

            return [
                'status' => 201,
                'data'   => [
                    'message'     => 'Thank you! Your vendor registration and documents have been submitted successfully. Our procurement team will review your application shortly.',
                    'response_id' => $response->id,
                ]
            ];
        });

        return response()->json($result['data'], $result['status']);
    }

    private function notifyAdmins(VendorOnboardingResponse $response, VendorOnboardingInvite $invite): void
    {
        try {
            // Find tenant admin or system super admin to notify
            $adminEmail = $invite->invitedBy?->email;
            if (!$adminEmail) {
                $superAdmin = User::whereHas('tenantRoles', fn($q) => $q->where('role', 'zopa_super_admin'))->first();
                $adminEmail = $superAdmin?->email;
            }

            if ($adminEmail) {
                Mail::to($adminEmail)->queue(new VendorOnboardingSubmittedMail($response));
            }
        } catch (\Throwable $e) {
            \Log::warning("Failed to queue onboarding submission alert: " . $e->getMessage());
        }
    }
}
