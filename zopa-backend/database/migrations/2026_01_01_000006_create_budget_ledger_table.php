<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cost_center_id')->constrained()->cascadeOnDelete();
            $table->year('fiscal_year');
            $table->string('reference_type', 20); // PR | PO | GRN | INVOICE
            $table->unsignedBigInteger('reference_id');
            $table->decimal('freeze_amount', 15, 2)->default(0);
            $table->decimal('consume_amount', 15, 2)->default(0);
            $table->enum('action', ['freeze', 'release', 'consume']);
            $table->string('narration')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['cost_center_id', 'fiscal_year']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_ledger');
    }
};
