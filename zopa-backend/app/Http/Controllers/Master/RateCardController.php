<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\RateCard;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Per-organisation vendor terms for products (unit, MOQ, MRP, net rate, lead time).
 * Every create, change and delete is written to activity_logs (entity_type RATE_CARD)
 * in the same transaction.
 */
class RateCardController extends Controller
{
    use AuthorizesRoles;

    private const TERM_RULES = [
        'uom'            => 'required|string|max:20',
        'moq'            => 'nullable|numeric|gt:0|max:999999999999',
        'mrp'            => 'nullable|numeric|gt:0|max:9999999999999',
        'net_rate'       => 'required|numeric|gt:0|max:9999999999999',
        'lead_time_days' => 'nullable|integer|min:0|max:3650',
    ];

    public function index(Request $request): JsonResponse
    {
        // The PO form reads the vendor's rates, so PO writers may list them too.
        abort_unless(
            $this->can('rate_cards', 'view') || $this->can('purchase_orders', 'create') || $this->can('purchase_orders', 'edit'),
            403, 'Your role does not permit this action (view on rate_cards).'
        );

        $query = RateCard::where('tenant_id', app('currentTenant')->id)
            ->with(['vendor:id,name,global_vendor_code', 'product:id,code,name,unit,net_rate,gst_rate', 'updater:id,name']);

        foreach (['vendor_id', 'product_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->integer($filter));
            }
        }

        return response()->json($query->latest('updated_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('rate_cards', 'create');
        $tenantId = app('currentTenant')->id;

        $data = $request->validate([
            'vendor_id'  => ['required', 'integer', Rule::exists('vendors', 'id')->where('tenant_id', $tenantId)],
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('tenant_id', $tenantId),
                Rule::unique('rate_cards')->where('tenant_id', $tenantId)->where('vendor_id', $request->integer('vendor_id'))],
            ...self::TERM_RULES,
        ], [
            'product_id.unique' => 'This vendor already has a rate card for this product. Edit that one instead.',
        ]);
        $this->assertWithinMrp(Product::findOrFail($data['product_id']), $data);

        $card = DB::transaction(function () use ($data, $tenantId) {
            $card = RateCard::create([...$data, 'tenant_id' => $tenantId, 'updated_by' => auth()->id()]);
            $this->logChange($card, 'created', $this->diff([], $card));
            return $card;
        });

        return response()->json($card->load(['vendor:id,name', 'product:id,code,name', 'updater:id,name']), 201);
    }

    public function update(Request $request, RateCard $rateCard): JsonResponse
    {
        $this->requirePermission('rate_cards', 'edit');
        $this->authorizeRateCard($rateCard);

        $data = $request->validate(self::TERM_RULES);
        $this->assertWithinMrp($rateCard->product, $data);

        DB::transaction(function () use ($rateCard, $data) {
            $before = $rateCard->only(RateCard::TERMS);
            $rateCard->fill($data);
            if ($rateCard->isDirty(RateCard::TERMS)) {
                $changes = $this->diff($before, $rateCard, onlyDirty: true);
                $rateCard->fill(['updated_by' => auth()->id()])->save();
                $this->logChange($rateCard, 'updated', $changes);
            }
        });

        return response()->json($rateCard->fresh(['vendor:id,name', 'product:id,code,name', 'updater:id,name']));
    }

    public function destroy(RateCard $rateCard): JsonResponse
    {
        $this->requirePermission('rate_cards', 'delete');
        $this->authorizeRateCard($rateCard);

        DB::transaction(function () use ($rateCard) {
            $changes = [];
            foreach (RateCard::TERMS as $field) {
                if ($rateCard->$field !== null) {
                    $changes[$field] = ['old' => self::logValue($field, $rateCard->$field), 'new' => null];
                }
            }
            $this->logChange($rateCard, 'deleted', $changes);
            $rateCard->delete();
        });

        return response()->json(null, 204);
    }

    /** The change log, newest first; filter by vendor_id and/or product_id. */
    public function log(Request $request): JsonResponse
    {
        $this->requirePermission('rate_cards', 'view');

        $query = ActivityLog::with('user:id,name')
            ->where('tenant_id', app('currentTenant')->id)
            ->where('entity_type', 'RATE_CARD');

        foreach (['vendor_id', 'product_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where("meta->{$filter}", $request->integer($filter));
            }
        }

        $perPage = min(max($request->integer('per_page', 50), 1), 200);
        return response()->json($query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage));
    }

    private function authorizeRateCard(RateCard $rateCard): void
    {
        abort_if($rateCard->tenant_id !== app('currentTenant')->id, 403);
    }

    /** Gross price (net plus the item master's GST) may not exceed the card's MRP. */
    private function assertWithinMrp(Product $product, array $data): void
    {
        if (empty($data['mrp'])) {
            return;
        }
        $gross = round((float) $data['net_rate'] * (1 + (float) $product->gst_rate / 100), 2);
        if ($gross > round((float) $data['mrp'], 2)) {
            throw ValidationException::withMessages(['mrp' => sprintf(
                'The gross price %s (net %s + %s%% GST from the item master) is above the MRP %s.',
                number_format($gross, 2),
                number_format((float) $data['net_rate'], 2),
                0 + (float) $product->gst_rate,
                number_format((float) $data['mrp'], 2),
            )]);
        }
    }

    /** Old and new value of each term that changed (or, for a new card, is set). */
    private function diff(array $before, RateCard $card, bool $onlyDirty = false): array
    {
        $changes = [];
        foreach (RateCard::TERMS as $field) {
            if ($onlyDirty ? $card->isDirty($field) : $card->$field !== null) {
                $changes[$field] = [
                    'old' => self::logValue($field, $before[$field] ?? null),
                    'new' => self::logValue($field, $card->$field),
                ];
            }
        }
        return $changes;
    }

    private static function logValue(string $field, $value): string|int|float|null
    {
        return match (true) {
            $value === null             => null,
            $field === 'uom'            => (string) $value,
            $field === 'lead_time_days' => (int) $value,
            default                     => (float) $value,
        };
    }

    /**
     * Written directly rather than through ActivityLogService, which swallows
     * failures: a rate card change must not save without its log entry.
     * Names are copied in so an entry stays readable after its card is deleted.
     */
    private function logChange(RateCard $card, string $action, array $changes): void
    {
        $card->loadMissing(['vendor:id,name', 'product:id,code,name']);

        ActivityLog::forceCreate([
            'created_at'  => now(),
            'tenant_id'   => $card->tenant_id,
            'entity_type' => 'RATE_CARD',
            'entity_id'   => $card->id,
            'user_id'     => auth()->id(),
            'action'      => $action,
            'meta'        => [
                'vendor_id'    => $card->vendor_id,
                'vendor'       => $card->vendor?->name,
                'product_id'   => $card->product_id,
                'product'      => $card->product?->name,
                'product_code' => $card->product?->code,
                'changes'      => $changes,
            ],
        ]);
    }
}
