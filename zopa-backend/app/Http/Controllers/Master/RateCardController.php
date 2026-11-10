<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\RateCard;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Per-organisation vendor rates for products. Every create, rate change and delete
 * is written to activity_logs (entity_type RATE_CARD) in the same transaction.
 */
class RateCardController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request): JsonResponse
    {
        // The PO form reads the vendor's rates, so PO writers may list them too.
        abort_unless(
            $this->can('rate_cards', 'view') || $this->can('purchase_orders', 'create') || $this->can('purchase_orders', 'edit'),
            403, 'Your role does not permit this action (view on rate_cards).'
        );

        $query = RateCard::where('tenant_id', app('currentTenant')->id)
            ->with(['vendor:id,name,global_vendor_code', 'product:id,code,name,unit,net_rate', 'updater:id,name']);

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
            'net_rate'   => 'required|numeric|gt:0|max:9999999999999',
        ], [
            'product_id.unique' => 'This vendor already has a rate card for this product. Edit that one instead.',
        ]);

        $card = DB::transaction(function () use ($data, $tenantId) {
            $card = RateCard::create([...$data, 'tenant_id' => $tenantId, 'updated_by' => auth()->id()]);
            $this->logChange($card, 'created', null, $card->net_rate);
            return $card;
        });

        return response()->json($card->load(['vendor:id,name', 'product:id,code,name', 'updater:id,name']), 201);
    }

    public function update(Request $request, RateCard $rateCard): JsonResponse
    {
        $this->requirePermission('rate_cards', 'edit');
        $this->authorizeRateCard($rateCard);

        $data = $request->validate(['net_rate' => 'required|numeric|gt:0|max:9999999999999']);

        DB::transaction(function () use ($rateCard, $data) {
            $old = $rateCard->net_rate;
            $rateCard->fill([...$data, 'updated_by' => auth()->id()]);
            if ($rateCard->isDirty('net_rate')) {
                $rateCard->save();
                $this->logChange($rateCard, 'updated', $old, $rateCard->net_rate);
            }
        });

        return response()->json($rateCard->fresh(['vendor:id,name', 'product:id,code,name', 'updater:id,name']));
    }

    public function destroy(RateCard $rateCard): JsonResponse
    {
        $this->requirePermission('rate_cards', 'delete');
        $this->authorizeRateCard($rateCard);

        DB::transaction(function () use ($rateCard) {
            $this->logChange($rateCard, 'deleted', $rateCard->net_rate, null);
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

    /**
     * Written directly rather than through ActivityLogService, which swallows
     * failures: a rate change must not save without its log entry.
     * Names are copied in so an entry stays readable after its card is deleted.
     */
    private function logChange(RateCard $card, string $action, $old, $new): void
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
                'changes'      => ['net_rate' => [
                    'old' => $old === null ? null : (float) $old,
                    'new' => $new === null ? null : (float) $new,
                ]],
            ],
        ]);
    }
}
