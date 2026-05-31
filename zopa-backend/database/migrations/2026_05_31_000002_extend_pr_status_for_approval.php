<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Extends the purchase_requisitions.status ENUM to include the multi-level
 * approval states (pending_l1/l2/l3) that ApprovalService already sets when a
 * PR is routed through an approval config. Without these values the routing
 * UPDATE was being truncated/rejected — a latent bug surfaced once PR approval
 * notifications were wired up. Also adds 'partially_converted' for completeness.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE purchase_requisitions
            MODIFY COLUMN status
            ENUM('draft','submitted','pending_l1','pending_l2','pending_l3',
                 'rfq_created','rfq_approved','converted','partially_converted','rejected')
            NOT NULL DEFAULT 'draft'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE purchase_requisitions
            MODIFY COLUMN status
            ENUM('draft','submitted','rfq_created','rfq_approved','converted','rejected')
            NOT NULL DEFAULT 'draft'
        ");
    }
};
