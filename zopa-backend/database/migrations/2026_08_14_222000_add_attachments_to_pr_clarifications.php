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
        Schema::table('pr_clarifications', function (Blueprint $table) {
            if (!Schema::hasColumn('pr_clarifications', 'request_attachments')) {
                $table->json('request_attachments')->nullable()->after('request_notes');
            }
            if (!Schema::hasColumn('pr_clarifications', 'response_attachments')) {
                $table->json('response_attachments')->nullable()->after('response_notes');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pr_clarifications', function (Blueprint $table) {
            if (Schema::hasColumn('pr_clarifications', 'request_attachments')) {
                $table->dropColumn('request_attachments');
            }
            if (Schema::hasColumn('pr_clarifications', 'response_attachments')) {
                $table->dropColumn('response_attachments');
            }
        });
    }
};
