<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('database_dump_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('user_name', 150);
            $table->string('user_email', 150);
            $table->string('file_name', 200);
            $table->unsignedBigInteger('file_size_bytes')->default(0);
            $table->string('format', 20)->default('sql.gz');
            $table->string('ip_address', 45)->nullable();
            $table->string('status', 20)->default('completed'); // completed, failed
            $table->text('error_message')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('database_dump_logs');
    }
};
