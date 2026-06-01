<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent when a user requests a password reset. Contains a one-time, time-limited
 * link back into the Angular app (FRONTEND_URL/reset-password?token=…&email=…).
 */
class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $userName;
    public int $expiresMinutes;

    public function __construct(public User $user, public string $resetUrl)
    {
        $this->userName       = $user->name ?: 'there';
        $this->expiresMinutes = (int) config('auth.passwords.users.expire', 60);
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Reset your ZOPA password');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.password-reset');
    }
}
