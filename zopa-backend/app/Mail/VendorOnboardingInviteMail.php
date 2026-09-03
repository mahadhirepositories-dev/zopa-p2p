<?php

namespace App\Mail;

use App\Models\VendorOnboardingInvite;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VendorOnboardingInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $vendorName;
    public string $tenantName;
    public string $templateName;
    public ?string $description;
    public string $onboardingUrl;
    public string $expiresAt;

    public function __construct(public VendorOnboardingInvite $invite)
    {
        $invite->loadMissing('tenant', 'template');
        $this->vendorName    = $invite->vendor_name ?: 'Partner';
        $this->tenantName    = $invite->tenant?->name ?: 'ZOPA Procurement';
        $this->templateName  = $invite->template?->name ?: 'Vendor Registration Form';
        $this->description   = $invite->template?->description;
        $this->expiresAt     = $invite->expires_at->format('d M Y, h:i A');

        $frontendUrl         = rtrim((string) config('app.frontend_url'), '/');
        $this->onboardingUrl = "{$frontendUrl}/vendor-onboarding/{$invite->token}";
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Invitation to Register as an Approved Vendor — {$this->tenantName}"
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.vendor-onboarding-invite');
    }
}
