<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Self-service profile: name/phone update, password change, /me payload.
 */
class ProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
    }

    private function user(string $email = 'cbuyer@acmetest.com'): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    public function test_profile_endpoints_require_authentication(): void
    {
        $this->putJson('/api/auth/profile', ['name' => 'X'])->assertStatus(401);
        $this->putJson('/api/auth/password', [])->assertStatus(401);
    }

    public function test_any_user_can_update_name_and_phone(): void
    {
        Sanctum::actingAs($this->user());

        $this->putJson('/api/auth/profile', ['name' => 'Bharani Kumar', 'phone' => '+91 90000 11111'])
            ->assertStatus(200)
            ->assertJsonPath('user.name', 'Bharani Kumar')
            ->assertJsonPath('user.phone', '+91 90000 11111');

        $this->assertDatabaseHas('users', [
            'email' => 'cbuyer@acmetest.com',
            'name'  => 'Bharani Kumar',
            'phone' => '+91 90000 11111',
        ]);
    }

    public function test_name_is_required_on_profile_update(): void
    {
        Sanctum::actingAs($this->user());
        $this->putJson('/api/auth/profile', ['name' => ''])->assertStatus(422);
    }

    public function test_me_returns_phone_field(): void
    {
        $u = $this->user();
        $u->update(['phone' => '12345']);
        Sanctum::actingAs($u);

        $this->getJson('/api/auth/me')
            ->assertStatus(200)
            ->assertJsonPath('user.phone', '12345');
    }

    public function test_password_change_requires_correct_current_password(): void
    {
        Sanctum::actingAs($this->user());

        $this->putJson('/api/auth/password', [
            'current_password'      => 'totally-wrong',
            'password'              => 'NewPass@123',
            'password_confirmation' => 'NewPass@123',
        ])->assertStatus(422)
          ->assertJsonValidationErrors('current_password');
    }

    public function test_password_change_requires_confirmation_match(): void
    {
        Sanctum::actingAs($this->user());

        $this->putJson('/api/auth/password', [
            'current_password'      => TestDataSeeder::PASSWORD,
            'password'              => 'NewPass@123',
            'password_confirmation' => 'different',
        ])->assertStatus(422)
          ->assertJsonValidationErrors('password');
    }

    public function test_user_can_change_password(): void
    {
        Sanctum::actingAs($this->user());

        $this->putJson('/api/auth/password', [
            'current_password'      => TestDataSeeder::PASSWORD,
            'password'              => 'NewPass@123',
            'password_confirmation' => 'NewPass@123',
        ])->assertStatus(200);

        $this->assertTrue(Hash::check('NewPass@123', $this->user()->fresh()->password));
    }
}
