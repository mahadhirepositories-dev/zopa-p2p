<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->enum('invoice_type', ['regular', 'advance', 'proforma'])->default('regular')->after('vendor_invoice_ref');
            $table->decimal('freight', 15, 2)->default(0)->after('amount');
            $table->decimal('taxable_amount', 15, 2)->default(0)->after('freight');
            $table->decimal('tax_amount', 15, 2)->default(0)->after('taxable_amount');
            $table->text('notes')->nullable()->after('tax_amount');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['invoice_type', 'freight', 'taxable_amount', 'tax_amount', 'notes']);
        });
    }
};
