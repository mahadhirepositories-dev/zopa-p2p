<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RateCard extends Model
{
    protected $fillable = ['tenant_id', 'vendor_id', 'product_id', 'net_rate', 'updated_by'];

    protected $casts = ['net_rate' => 'decimal:2'];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * The rate a PO line must use, per product id: the vendor's rate card, else the
     * product master rate when it is above zero. Products missing from the result
     * have no locked rate, so the buyer types one.
     *
     * @return array<int, array{rate: float, source: string}>
     */
    public static function lockedRates(int $tenantId, ?int $vendorId, array $productIds): array
    {
        $productIds = array_values(array_unique(array_filter(array_map('intval', $productIds))));
        if (!$productIds) {
            return [];
        }

        $cards = $vendorId
            ? self::where('tenant_id', $tenantId)->where('vendor_id', $vendorId)
                ->whereIn('product_id', $productIds)->pluck('net_rate', 'product_id')
            : collect();

        $locked = [];
        $products = Product::where('tenant_id', $tenantId)->whereIn('id', $productIds)->pluck('net_rate', 'id');
        foreach ($products as $id => $productRate) {
            if ($cards->has($id)) {
                $locked[$id] = ['rate' => (float) $cards[$id], 'source' => 'rate_card'];
            } elseif ((float) $productRate > 0) {
                $locked[$id] = ['rate' => (float) $productRate, 'source' => 'product'];
            }
        }
        return $locked;
    }
}
