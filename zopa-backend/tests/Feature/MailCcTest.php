<?php

namespace Tests\Feature;

use App\Mail\{ApprovalRequestMail, PurchaseOrderIssuedMail};
use App\Models\{Approval, CostCenter, PoItem, PurchaseOrder, Tenant, User, Vendor};
use Database\Seeders\TestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Vendor + approval emails CC the buyer who raised the document. */
class MailCcTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $acme;
    private User $buyer;
    private User $approver;
    private PurchaseOrder $po;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TestDataSeeder::class);
        $this->acme     = Tenant::where('code', 'ACME')->firstOrFail();
        $this->buyer    = User::where('email', 'cbuyer@acmetest.com')->firstOrFail();
        $this->approver = User::where('email', 'cl1@acmetest.com')->firstOrFail();
        $cc             = CostCenter::where('tenant_id', $this->acme->id)->firstOrFail();

        $this->po = PurchaseOrder::create([
            'tenant_id' => $this->acme->id, 'cost_center_id' => $cc->id,
            'vendor_id' => Vendor::query()->value('id'), 'status' => 'released',
            'po_number' => 'ACME-PO-2026-0001', 'po_date' => now(), 'po_valid_till' => now()->addDays(30),
            'net_total' => 100, 'tax_amount' => 18, 'grand_total' => 118, 'freight' => 0,
            'created_by' => $this->buyer->id, 'created_by_role' => 'client_buyer',
        ]);
        PoItem::create([
            'po_id' => $this->po->id, 'sno' => 1, 'description' => 'Item', 'qty' => 1,
            'net_rate' => 100, 'gst_rate' => 18, 'gross_rate' => 118, 'amount' => 118,
        ]);
    }

    public function test_po_to_vendor_email_ccs_the_creator(): void
    {
        $mail = new PurchaseOrderIssuedMail($this->po);
        $this->assertContains($this->buyer->email, $mail->ccList);
    }

    public function test_approval_request_ccs_the_raiser_not_the_approver(): void
    {
        $approval = Approval::create([
            'entity_type' => 'PO', 'entity_id' => $this->po->id, 'level' => 1,
            'assigned_to_user_id' => $this->approver->id, 'action' => 'pending',
        ]);

        $mail = new ApprovalRequestMail($approval, 'PO', $this->po);

        $this->assertContains($this->buyer->email, $mail->ccList);      // raiser is CC'd
        $this->assertNotContains($this->approver->email, $mail->ccList); // approver isn't CC'd
    }

    public function test_no_self_cc_when_raiser_is_the_approver(): void
    {
        // The buyer is also the assigned approver → don't CC them their own request.
        $approval = Approval::create([
            'entity_type' => 'PO', 'entity_id' => $this->po->id, 'level' => 1,
            'assigned_to_user_id' => $this->buyer->id, 'action' => 'pending',
        ]);

        $mail = new ApprovalRequestMail($approval, 'PO', $this->po);

        $this->assertSame([], $mail->ccList);
    }
}
