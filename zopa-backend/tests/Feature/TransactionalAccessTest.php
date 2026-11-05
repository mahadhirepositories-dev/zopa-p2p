<?php

namespace Tests\Feature;

use App\Models\PurchaseRequisition;
use App\Models\RolePermission;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Transactional-document access is governed by the Access Control matrix:
 * create/edit/delete on PR/PO/GRN/Invoice honor requirePermission(), and a
 * coarse role gate must not override a matrix grant (the PR-delete bug).
 */
class TransactionalAccessTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private int $costCenterId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        Cache::flush();
        $this->acme = Tenant::where('code', 'ACME')->firstOrFail();
        $this->costCenterId = \App\Models\CostCenter::where('tenant_id', $this->acme->id)->firstOrFail()->id;
    }

    private function actAs(string $email): self
    {
        Sanctum::actingAs(User::where('email', $email)->firstOrFail());
        return $this;
    }

    private function headers(): array
    {
        return ['X-Tenant-ID' => (string) $this->acme->id];
    }

    private function draftPr(string $requesterEmail): PurchaseRequisition
    {
        return PurchaseRequisition::create([
            'tenant_id'        => $this->acme->id,
            'cost_center_id'   => $this->costCenterId,
            'pr_ref'           => 'PR-DRAFT-' . uniqid(),
            'title'            => 'Draft PR',
            'estimated_amount' => 1000,
            'priority'         => 'normal',
            'status'           => 'draft',
            'requested_by'     => User::where('email', $requesterEmail)->firstOrFail()->id,
        ]);
    }

    /** Bug B: a buyer granted delete in the matrix can delete a draft PR raised by someone else. */
    public function test_pr_delete_respects_matrix_grant(): void
    {
        RolePermission::updateOrCreate(
            ['role' => 'client_buyer', 'module' => 'purchase_requisitions'],
            ['can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => true],
        );
        Cache::flush();

        $pr = $this->draftPr('cadmin@acmetest.com');

        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->headers())
            ->deleteJson("/api/purchase-requisitions/{$pr->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('purchase_requisitions', ['id' => $pr->id]);
    }

    public function test_pr_delete_blocked_without_matrix_permission(): void
    {
        $pr = $this->draftPr('cadmin@acmetest.com'); // client_buyer default: delete = false

        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->headers())
            ->deleteJson("/api/purchase-requisitions/{$pr->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('purchase_requisitions', ['id' => $pr->id]);
    }

    /** The requester may discard their own draft without a matrix delete grant. */
    public function test_requester_can_delete_own_draft_without_matrix_permission(): void
    {
        $pr = $this->draftPr('cbuyer@acmetest.com');

        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->headers())
            ->deleteJson("/api/purchase-requisitions/{$pr->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('purchase_requisitions', ['id' => $pr->id]);
    }

    public function test_transactional_create_is_matrix_enforced(): void
    {
        // Revoke PR create for client_buyer → create must be blocked at the API.
        RolePermission::updateOrCreate(
            ['role' => 'client_buyer', 'module' => 'purchase_requisitions'],
            ['can_view' => true, 'can_create' => false, 'can_edit' => true, 'can_delete' => false],
        );
        Cache::flush();

        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->headers())
            ->postJson('/api/purchase-requisitions', [
                'title' => 'X', 'cost_center_id' => $this->costCenterId,
                'items' => [['description' => 'a', 'qty' => 1, 'estimated_price' => 1]],
            ])
            ->assertStatus(403);
    }

    public function test_buyer_with_default_create_can_create_pr(): void
    {
        // client_buyer default has PR create = true.
        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->headers())
            ->postJson('/api/purchase-requisitions', [
                'title' => 'Office chairs', 'cost_center_id' => $this->costCenterId,
                'items' => [['description' => 'Chair', 'qty' => 2, 'estimated_price' => 5000]],
            ])
            ->assertStatus(201);
    }

    public function test_cleanup_drafts_blocked_without_matrix_delete(): void
    {
        $pr = $this->draftPr('cbuyer@acmetest.com');

        $this->actAs('cl1@acmetest.com')
            ->withHeaders($this->headers())
            ->deleteJson('/api/purchase-requisitions/cleanup-drafts')
            ->assertStatus(403);

        $this->assertDatabaseHas('purchase_requisitions', ['id' => $pr->id]);
    }

    /** Cleanup spans the whole tenant, so the requester rule on single delete does not apply. */
    public function test_cleanup_drafts_blocked_for_requester_without_matrix_delete(): void
    {
        $pr = $this->draftPr('cbuyer@acmetest.com');

        $this->actAs('cbuyer@acmetest.com')
            ->withHeaders($this->headers())
            ->deleteJson('/api/purchase-requisitions/cleanup-drafts')
            ->assertStatus(403);

        $this->assertDatabaseHas('purchase_requisitions', ['id' => $pr->id]);
    }

    public function test_cleanup_drafts_respects_matrix_grant(): void
    {
        RolePermission::updateOrCreate(
            ['role' => 'client_approver_l1', 'module' => 'purchase_requisitions'],
            ['can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => true],
        );
        Cache::flush();

        $pr = $this->draftPr('cbuyer@acmetest.com');

        $this->actAs('cl1@acmetest.com')
            ->withHeaders($this->headers())
            ->deleteJson('/api/purchase-requisitions/cleanup-drafts')
            ->assertStatus(200);

        $this->assertDatabaseMissing('purchase_requisitions', ['id' => $pr->id]);
    }
}
