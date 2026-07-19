<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('grns', function (Blueprint $table) {
            $table->string('dc_number')->nullable()->after('received_by');
            $table->date('dc_date')->nullable()->after('dc_number');
            $table->string('invoice_number')->nullable()->after('dc_date');
            $table->date('invoice_date')->nullable()->after('invoice_number');
        });

        Schema::create('grn_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grn_id')->constrained('grns')->cascadeOnDelete();
            $table->string('name');
            $table->string('original_name');
            $table->string('file_path');
            $table->unsignedInteger('size')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('grn_attachments');
        Schema::table('grns', function (Blueprint $table) {
            $table->dropColumn(['dc_number', 'dc_date', 'invoice_number', 'invoice_date']);
        });
    }
};
