<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Specifically clean AV-PO-27 in tenant 7 (Apollo Vidhyalayam) or any PO matching 27
        $pos = DB::table('purchase_orders')
            ->where('po_number', 'like', '%27%')
            ->get();

        foreach ($pos as $po) {
            $items = DB::table('po_items')->where('po_id', $po->id)->get();
            foreach ($items as $it) {
                if (!empty($it->product_name) && !empty($it->description)) {
                    $name = trim($it->product_name);
                    $desc = trim($it->description);

                    if (strtolower($desc) === strtolower("{$name} - {$name}")) {
                        DB::table('po_items')->where('id', $it->id)->update(['description' => $name]);
                    } elseif (str_starts_with(strtolower($desc), strtolower($name))) {
                        $rem = trim(substr($desc, strlen($name)));
                        $rem = ltrim($rem, " \t\n\r\0\x0B-–—:/");
                        if (empty($rem) || strtolower($rem) === strtolower($name) || str_contains(strtolower($name), strtolower($rem))) {
                            DB::table('po_items')->where('id', $it->id)->update(['description' => $name]);
                        }
                    }
                }
            }
        }

        // 2. Also general cleanup across all po_items where description redundantly repeats product_name
        $redundantItems = DB::table('po_items')
            ->whereNotNull('product_name')
            ->whereRaw("description LIKE CONCAT(product_name, ' - %')")
            ->get();

        foreach ($redundantItems as $it) {
            $name = trim($it->product_name);
            $desc = trim($it->description);
            $rem = trim(substr($desc, strlen($name)));
            $rem = ltrim($rem, " \t\n\r\0\x0B-–—:/");
            if (empty($rem) || strtolower($rem) === strtolower($name) || str_contains(strtolower($name), strtolower($rem))) {
                DB::table('po_items')->where('id', $it->id)->update(['description' => $name]);
            }
        }
    }

    public function down(): void
    {
    }
};
