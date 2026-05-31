<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tat_records', function (Blueprint $table) {
            $table->foreignId('pr_id')->nullable()->constrained('purchase_requisitions')->nullOnDelete()->after('po_id');
            $table->timestamp('po_delivered_at')->nullable()->after('grn_received_at');
        });
    }

    public function down(): void
    {
        Schema::table('tat_records', function (Blueprint $table) {
            $table->dropForeign(['pr_id']);
            $table->dropColumn(['pr_id', 'po_delivered_at']);
        });
    }
};
