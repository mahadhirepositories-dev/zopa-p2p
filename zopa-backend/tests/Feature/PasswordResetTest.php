<?php

namespace Tests\Feature;

use App\Mail\PasswordResetMail;
use App\Models\User;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Mail::fake();
    }

    public function test_forgot_password_emails_reset_link_for_existing_user(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'cbuyer@acmetest.com'])
            ->assertStatus(200);

        Mail::assertQueued(PasswordResetMail::class, fn ($m) => $m->hasTo('cbuyer@acmetest.com'));
    }

    public function test_forgot_password_does_not_reveal_unknown_email(): void
    {
        // Still 200 (no enumeration) but nothing is sent.
        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com'])
            ->assertStatus(200);

        Mail::assertNothingQueued();
    }

    public function test_reset_password_with_valid_token_changes_password(): void
    {
        $user  = User::where('email', 'cbuyer@acmetest.com')->firstOrFail();
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'NewPass@123',
            'password_confirmation' => 'NewPass@123',
        ])->assertStatus(200);

        $this->assertTrue(Hash::check('NewPass@123', $user->fresh()->password));
    }

    public function test_reset_password_with_invalid_token_fails(): void
    {
        $this->postJson('/api/auth/reset-password', [
            'token'                 => 'totally-invalid-token',
            'email'                 => 'cbuyer@acmetest.com',
            'password'              => 'NewPass@123',
            'password_confirmation' => 'NewPass@123',
        ])->assertStatus(422);
    }
}
