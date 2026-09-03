<?php

namespace App\Mail;

use App\Models\VendorOnboardingResponse;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VendorOnboardingSubmittedMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $vendorName;
    public string $vendorEmail;
    public ?string $vendorPhone;
    public string $tenantName;
    public string $templateName;
    public string $submittedAt;
    public string $reviewUrl;

    public function __construct(public VendorOnboardingResponse $response)
    {
        $response->loadMissing('tenant', 'template', 'invite');

        $formData = $response->form_data ?? [];
        $this->vendorName    = $formData['name'] ?? $response->invite?->vendor_name ?? 'Prospective Vendor';
        $this->vendorEmail   = $formData['email'] ?? $response->invite?->vendor_email ?? '—';
        $this->vendorPhone   = $formData['phone'] ?? $response->invite?->phone;
        $this->tenantName    = $response->tenant?->name ?: 'ZOPA Procurement';
        $this->templateName  = $response->template?->name ?: 'Vendor Onboarding Form';
        $this->submittedAt   = now()->format('d M Y, h:i A');

        $frontendUrl         = rtrim((string) config('app.frontend_url'), '/');
        $this->reviewUrl     = "{$frontendUrl}/admin/vendor-onboarding?id={$response->id}";
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New Vendor Onboarding Submission: {$this->vendorName} — {$this->tenantName}"
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.vendor-onboarding-submitted');
    }
}
