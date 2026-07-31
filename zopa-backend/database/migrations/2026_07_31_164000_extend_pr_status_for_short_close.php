<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Extends purchase_requisitions.status ENUM to include short-close workflow states.
 * The MODIFY COLUMN statement REPLACES the ENUM entirely, so ALL existing values
 * must be listed — this is additive (no existing data is touched).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE purchase_requisitions
            MODIFY COLUMN status
            ENUM(
                'draft',
                'submitted',
                'pending_l1','pending_l2','pending_l3',
                'rfq_created','rfq_approved',
                'converted','partially_converted',
                'rejected',
                'short_close_pending_l1','short_close_pending_l2','short_close_pending_l3',
                'short_closed'
            )
            NOT NULL DEFAULT 'draft'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE purchase_requisitions
            MODIFY COLUMN status
            ENUM('draft','submitted','pending_l1','pending_l2','pending_l3',
                 'rfq_created','rfq_approved','converted','partially_converted','rejected')
            NOT NULL DEFAULT 'draft'
        ");
    }
};
