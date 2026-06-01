<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Models\UserTenantRole;
use App\Services\UserProvisioningService;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Re-adding a removed user must work (the reported bug): removal only
 * soft-deactivates the tenant role, so the users row + email persist.
 */
class UserProvisioningTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private UserProvisioningService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->svc  = app(UserProvisioningService::class);
    }

    private function admin(): User
    {
        return User::where('email', 'cadmin@acmetest.com')->firstOrFail();
    }

    public function test_creates_a_brand_new_user(): void
    {
        $utr = $this->svc->provisionClientUser($this->acme, [
            'name' => 'Fresh User', 'email' => 'fresh@acme.com',
            'password' => 'Secret@123', 'role' => 'client_buyer',
        ], $this->admin()->id);

        $this->assertTrue($utr->is_active);
        $this->assertEquals('client_buyer', $utr->role);
        $this->assertDatabaseHas('users', ['email' => 'fresh@acme.com']);
    }

    public function test_re_adding_a_removed_user_reactivates_them(): void
    {
        // Create, then "remove" (soft-deactivate the assignment).
        $utr = $this->svc->provisionClientUser($this->acme, [
            'name' => 'Rejoin User', 'email' => 'rejoin@acme.com',
            'password' => 'Secret@123', 'role' => 'client_buyer',
        ], $this->admin()->id);
        $userId = $utr->user_id;
        $utr->update(['is_active' => false]);

        // Re-add with the SAME email — must reactivate, not throw "email taken".
        $again = $this->svc->provisionClientUser($this->acme, [
            'name' => 'Rejoin User', 'email' => 'rejoin@acme.com',
            'password' => 'Secret@123', 'role' => 'client_approver_l1',
        ], $this->admin()->id);

        $this->assertEquals($userId, $again->user_id, 'Should reuse the same user account.');
        $this->assertTrue($again->is_active);
        $this->assertEquals('client_approver_l1', $again->role, 'Role can be updated on reactivation.');
        // Exactly one user + one assignment row for this email/tenant.
        $this->assertEquals(1, User::where('email', 'rejoin@acme.com')->count());
        $this->assertEquals(1, UserTenantRole::where('user_id', $userId)->where('tenant_id', $this->acme->id)->count());
    }

    public function test_adding_an_already_active_member_is_rejected(): void
    {
        $this->svc->provisionClientUser($this->acme, [
            'name' => 'Dup User', 'email' => 'dup@acme.com',
            'password' => 'Secret@123', 'role' => 'client_buyer',
        ], $this->admin()->id);

        $this->expectException(ValidationException::class);
        $this->svc->provisionClientUser($this->acme, [
            'name' => 'Dup User', 'email' => 'dup@acme.com',
            'password' => 'Secret@123', 'role' => 'client_buyer',
        ], $this->admin()->id);
    }

    public function test_existing_user_password_is_not_changed_on_reactivation(): void
    {
        $utr = $this->svc->provisionClientUser($this->acme, [
            'name' => 'Keep Pass', 'email' => 'keep@acme.com',
            'password' => 'Original@123', 'role' => 'client_buyer',
        ], $this->admin()->id);
        $originalHash = $utr->user->password;
        $utr->update(['is_active' => false]);

        $this->svc->provisionClientUser($this->acme, [
            'name' => 'Keep Pass', 'email' => 'keep@acme.com',
            'password' => 'DifferentNow@123', 'role' => 'client_buyer',
        ], $this->admin()->id);

        $this->assertEquals($originalHash, User::where('email', 'keep@acme.com')->first()->password,
            'Existing accounts keep their password (use password reset to change it).');
    }

    public function test_zopa_staff_email_cannot_be_added_as_client_user(): void
    {
        $this->expectException(ValidationException::class);
        $this->svc->provisionClientUser($this->acme, [
            'name' => 'Staffer', 'email' => 'zbuyer@zopatest.com',  // seeded ZOPA staff
            'password' => 'Secret@123', 'role' => 'client_buyer',
        ], $this->admin()->id);
    }

    public function test_endpoint_re_add_after_remove_succeeds(): void
    {
        // End-to-end through the Super Admin client-users endpoints.
        $superAdmin = User::where('email', 'superadmin@zopatest.com')->firstOrFail();

        $create = $this->actingAs($superAdmin)->postJson("/api/admin/clients/{$this->acme->id}/users", [
            'name' => 'E2E User', 'email' => 'e2e@acme.com',
            'password' => 'Secret@123', 'role' => 'client_buyer',
        ]);
        $create->assertStatus(201);
        $userId = $create->json('user_id') ?? $create->json('user.id');

        // Remove (soft) then re-add the same email.
        $this->actingAs($superAdmin)->deleteJson("/api/admin/clients/{$this->acme->id}/users/{$userId}")
            ->assertSuccessful();

        $this->actingAs($superAdmin)->postJson("/api/admin/clients/{$this->acme->id}/users", [
            'name' => 'E2E User', 'email' => 'e2e@acme.com',
            'password' => 'Secret@123', 'role' => 'client_buyer',
        ])->assertStatus(201);
    }
}
