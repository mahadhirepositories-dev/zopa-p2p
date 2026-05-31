<?php

namespace App\Services;

use App\Models\Approval;
use App\Models\EmailActionToken;
use Illuminate\Support\Str;

class TokenService
{
    public function generate(Approval $approval, string $action): string
    {
        $raw = Str::random(40);
        $token = hash_hmac('sha256', $raw, config('app.key'));

        EmailActionToken::create([
            'token' => $token,
            'approval_id' => $approval->id,
            'action' => $action,
            'approver_id' => $approval->assigned_to_user_id,
            'expires_at' => now()->addHours(72),
        ]);

        return $token;
    }

    public function validate(string $token): EmailActionToken
    {
        return EmailActionToken::where('token', $token)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->firstOrFail();
    }

    public function consume(EmailActionToken $record): void
    {
        $record->update(['used_at' => now()]);
    }
}
