<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RateCard extends Model
{
    /** Fields a buyer sets; every change to them is logged. */
    public const TERMS = ['uom', 'moq', 'mrp', 'net_rate', 'lead_time_days'];

    protected $fillable = ['tenant_id', 'vendor_id', 'product_id', ...self::TERMS, 'updated_by'];

    protected $casts = [
        'net_rate'       => 'decimal:2',
        'mrp'            => 'decimal:2',
        'moq'            => 'decimal:3',
        'lead_time_days' => 'integer',
    ];

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
     * What a PO line for each product id must follow: the vendor's rate card (rate,
     * unit and MOQ), else the product master rate when it is above zero (rate only).
     * Products missing from the result have nothing locked.
     *
     * @return array<int, array{rate: float, source: string, uom: ?string, moq: ?float}>
     */
    public static function lockedTerms(int $tenantId, ?int $vendorId, array $productIds): array
    {
        $productIds = array_values(array_unique(array_filter(array_map('intval', $productIds))));
        if (!$productIds) {
            return [];
        }

        $cards = $vendorId
            ? self::where('tenant_id', $tenantId)->where('vendor_id', $vendorId)
                ->whereIn('product_id', $productIds)->get()->keyBy('product_id')
            : collect();

        $locked = [];
        $products = Product::where('tenant_id', $tenantId)->whereIn('id', $productIds)->get(['id', 'net_rate', 'unit']);
        foreach ($products as $product) {
            if ($card = $cards->get($product->id)) {
                $locked[$product->id] = [
                    'rate'   => (float) $card->net_rate,
                    'source' => 'rate_card',
                    'uom'    => $card->uom ?? $product->unit,
                    'moq'    => $card->moq === null ? null : (float) $card->moq,
                ];
            } elseif ((float) $product->net_rate > 0) {
                $locked[$product->id] = ['rate' => (float) $product->net_rate, 'source' => 'product', 'uom' => null, 'moq' => null];
            }
        }
        return $locked;
    }
}
