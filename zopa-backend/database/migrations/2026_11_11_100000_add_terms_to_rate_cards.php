<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rate cards gain the vendor's unit, minimum order quantity, MRP and lead time.
 * The unit is fixed on the vendor's PO lines and MOQ is enforced there; lead time
 * pre-fills "Required by". Existing cards take their product's unit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rate_cards', function (Blueprint $table) {
            $table->string('uom', 20)->nullable()->after('product_id');
            $table->decimal('moq', 15, 3)->nullable()->after('uom');
            $table->decimal('mrp', 15, 2)->nullable()->after('moq');
            $table->unsignedSmallInteger('lead_time_days')->nullable()->after('net_rate');
        });

        DB::table('rate_cards')
            ->join('products', 'products.id', '=', 'rate_cards.product_id')
            ->whereNull('rate_cards.uom')
            ->update(['rate_cards.uom' => DB::raw('LEFT(products.unit, 20)')]);
    }

    public function down(): void
    {
        Schema::table('rate_cards', function (Blueprint $table) {
            $table->dropColumn(['uom', 'moq', 'mrp', 'lead_time_days']);
        });
    }
};
