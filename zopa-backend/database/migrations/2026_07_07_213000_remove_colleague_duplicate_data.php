<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $apollo = DB::table('tenants')->where('name', 'Apollo Isha Vidhya Niketan')->first();

        if (!$apollo) {
            return;
        }

        // 1. Delete the new Draft PR: "Sanitary Pad Destroyer Machine-AIVN"
        $draftPr = DB::table('purchase_requisitions')
            ->where('tenant_id', $apollo->id)
            ->where('title', 'Sanitary Pad Destroyer Machine-AIVN')
            ->where('status', 'draft')
            ->first();

        if ($draftPr) {
            DB::table('pr_items')->where('pr_id', $draftPr->id)->delete();
            DB::table('purchase_requisitions')->where('id', $draftPr->id)->delete();
        }

        // 2. Delete the new Product "AIVN01"
        $product = DB::table('products')
            ->where('tenant_id', $apollo->id)
            ->where('code', 'AIVN01')
            ->first();

        if ($product) {
            DB::table('products')->where('id', $product->id)->delete();
        }

        // 3. Delete the Vendor "SARA EQUIPMENTS" that has an address
        $vendors = DB::table('vendors')
            ->where('tenant_id', $apollo->id)
            ->where('name', 'SARA EQUIPMENTS')
            ->get();

        foreach ($vendors as $v) {
            $addressCount = DB::table('vendor_addresses')->where('vendor_id', $v->id)->count();
            if ($addressCount > 0) {
                DB::table('vendor_addresses')->where('vendor_id', $v->id)->delete();
                DB::table('vendor_categories')->where('vendor_id', $v->id)->delete();
                DB::table('vendor_documents')->where('vendor_id', $v->id)->delete();
                DB::table('vendors')->where('id', $v->id)->delete();
            }
        }
    }

    public function down(): void
    {
        // Not reversible
    }
};
