<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $totalHealth = DB::table('tenants')->where('name', 'TOTAL HEALTH')->first();
        $apollo = DB::table('tenants')->where('name', 'Apollo Isha Vidhya Niketan')->first();

        if (!$totalHealth || !$apollo) {
            return;
        }

        // 1. Find Vendor "SARA EQUIPMENTS" (might be in either if partially run)
        $vendor = DB::table('vendors')
            ->whereIn('tenant_id', [$totalHealth->id, $apollo->id])
            ->where('name', 'SARA EQUIPMENTS')
            ->first();

        if ($vendor && $vendor->tenant_id == $totalHealth->id) {
            DB::table('vendors')->where('id', $vendor->id)->update(['tenant_id' => $apollo->id]);
        }

        // 2. Move Cost Center "Apollo Isha Vidhya Niketan" if created in Total Health
        $costCenter = DB::table('cost_centers')
            ->where('tenant_id', $totalHealth->id)
            ->where('name', 'Apollo Isha Vidhya Niketan')
            ->first();

        if ($costCenter) {
            DB::table('cost_centers')->where('id', $costCenter->id)->update(['tenant_id' => $apollo->id]);
        }

        // 3. Move PR "PR1"
        $pr = DB::table('purchase_requisitions')
            ->where('tenant_id', $totalHealth->id)
            ->where('pr_number', 'PR1')
            ->first();

        if ($pr) {
            DB::table('purchase_requisitions')->where('id', $pr->id)->update(['tenant_id' => $apollo->id]);
            
            // Move products attached to this PR
            $prItems = DB::table('pr_items')->where('pr_id', $pr->id)->get();
            foreach ($prItems as $item) {
                if ($item->product_id) {
                    DB::table('products')->where('id', $item->product_id)->where('tenant_id', $totalHealth->id)->update(['tenant_id' => $apollo->id]);
                }
            }
        }

        // 4. Move Draft PO for SARA EQUIPMENTS
        if ($vendor) {
            $po = DB::table('purchase_orders')
                ->where('tenant_id', $totalHealth->id)
                ->where('vendor_id', $vendor->id)
                ->where('status', 'draft')
                ->first();

            if ($po) {
                DB::table('purchase_orders')->where('id', $po->id)->update(['tenant_id' => $apollo->id]);
                
                $poItems = DB::table('po_items')->where('po_id', $po->id)->get();
                foreach ($poItems as $item) {
                    if ($item->product_id) {
                        DB::table('products')->where('id', $item->product_id)->where('tenant_id', $totalHealth->id)->update(['tenant_id' => $apollo->id]);
                    }
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('apollo', function (Blueprint $table) {
            //
        });
    }
};
