<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseRequisition extends Model
{
    protected $fillable = [
        'tenant_id', 'pr_ref', 'pr_number', 'cost_center_id', 'project_id', 'location_id',
        'title', 'description', 'estimated_amount', 'priority',
        'required_by_date', 'required_by_person',
        'requested_by', 'buyer_id', 'status', 'submitted_at', 'converted_at',
        'short_close_reason', 'short_closed_at', 'short_closed_by',
        'needs_clarification', 'clarification_requested_at', 'clarification_requested_by',
        'clarification_provided_at', 'clarification_provided_by', 'total_clarification_duration_seconds',
    ];

    protected $casts = [
        'estimated_amount'                  => 'decimal:2',
        'needs_clarification'               => 'boolean',
        'submitted_at'                      => 'datetime',
        'converted_at'                      => 'datetime',
        'short_closed_at'                   => 'datetime',
        'clarification_requested_at'        => 'datetime',
        'clarification_provided_at'         => 'datetime',
        'required_by_date'                  => 'date',
        'total_clarification_duration_seconds' => 'integer',
    ];


    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function shortClosedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'short_closed_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PrItem::class, 'pr_id')->orderBy('sno');
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class, 'pr_id');
    }

    public function linkedPurchaseOrders(): BelongsToMany
    {
        return $this->belongsToMany(PurchaseOrder::class, 'po_prs', 'pr_id', 'po_id')
            ->withTimestamps();
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'entity_id')
            ->where('entity_type', 'PR')
            ->orderByDesc('created_at');
    }

    public function clarifications(): HasMany
    {
        return $this->hasMany(PrClarification::class, 'pr_id')->orderByDesc('created_at');
    }

    public function statusUpdates(): HasMany
    {
        return $this->hasMany(PrStatusUpdate::class, 'pr_id')->orderByDesc('created_at');
    }

    public static function syncPrConversion(self $pr): void
    {
        $pr->loadMissing(['items', 'purchaseOrders.items', 'linkedPurchaseOrders.items']);
        $allPos = $pr->purchaseOrders->concat($pr->linkedPurchaseOrders)->unique('id');

        if ($allPos->isEmpty()) {
            return;
        }

        // Flatten all PO items across linked POs
        $poItems = $allPos->pluck('items')->flatten();
        $prItems = $pr->items;
        $prItemIds = $prItems->pluck('id')->toArray();

        // 1. Intelligently match & link PO items to PR items, respecting existing valid links
        foreach ($poItems as $poItem) {
            // Respect valid existing link if description matches reasonably
            if (!empty($poItem->pr_item_id) && in_array($poItem->pr_item_id, $prItemIds)) {
                $linkedPrItem = $prItems->firstWhere('id', $poItem->pr_item_id);
                if ($linkedPrItem) {
                    $normPo = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $poItem->description ?? ''));
                    $normPr = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $linkedPrItem->description ?? ''));
                    if ($normPo === $normPr || empty($normPo) || empty($normPr)) {
                        continue;
                    }
                    similar_text($normPr, $normPo, $percent);
                    if ($percent >= 45 || str_contains($normPo, $normPr) || str_contains($normPr, $normPo)) {
                        continue;
                    }
                }
            }

            $poDesc = trim($poItem->description ?? '');
            $normPoDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $poDesc));

            $matchedPrItem = null;

            // Strategy A: Match by product_id if set
            if ($poItem->product_id) {
                $matchedPrItem = $prItems->firstWhere('product_id', $poItem->product_id);
            }

            // Strategy B: Exact or token match, prioritizing unfulfilled PR items
            if (!$matchedPrItem && !empty($normPoDesc)) {
                $exactMatches = $prItems->filter(function ($prIt) use ($normPoDesc) {
                    $normPrDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $prIt->description ?? ''));
                    return !empty($normPrDesc) && $normPrDesc === $normPoDesc;
                });

                if ($exactMatches->count() > 0) {
                    $matchedPrItem = $exactMatches->first(function ($prIt) use ($poItems) {
                        $currConverted = (float) $poItems->where('pr_item_id', $prIt->id)->sum('qty');
                        return $currConverted < (float) $prIt->qty;
                    }) ?? $exactMatches->first();
                }
            }

            // Strategy C: High similarity or substring match, prioritizing unfulfilled PR items
            if (!$matchedPrItem && !empty($normPoDesc)) {
                $similarMatches = $prItems->filter(function ($prIt) use ($normPoDesc) {
                    $normPrDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $prIt->description ?? ''));
                    if (empty($normPrDesc)) return false;
                    if (str_contains($normPoDesc, $normPrDesc) || str_contains($normPrDesc, $normPoDesc)) return true;
                    similar_text($normPrDesc, $normPoDesc, $percent);
                    return $percent >= 65;
                });

                if ($similarMatches->count() > 0) {
                    $matchedPrItem = $similarMatches->first(function ($prIt) use ($poItems) {
                        $currConverted = (float) $poItems->where('pr_item_id', $prIt->id)->sum('qty');
                        return $currConverted < (float) $prIt->qty;
                    }) ?? $similarMatches->first();
                }
            }

            // Strategy D: Match by sno ONLY if sno item description is compatible
            if (!$matchedPrItem) {
                $matchBySno = $prItems->firstWhere('sno', $poItem->sno);
                if ($matchBySno) {
                    $normPrDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $matchBySno->description ?? ''));
                    similar_text($normPrDesc, $normPoDesc, $percent);
                    if ($percent >= 40 || empty($normPrDesc) || empty($normPoDesc)) {
                        $matchedPrItem = $matchBySno;
                    }
                }
            }

            if ($matchedPrItem) {
                $poItem->update(['pr_item_id' => $matchedPrItem->id]);
            }
        }

        // Refresh poItems list after auto-linking
        $poItems = $allPos->fresh(['items'])->pluck('items')->flatten();

        // 2. Recalculate converted_qty on each PR item
        foreach ($pr->items as $prItem) {
            $totalConverted = (float) $poItems->where('pr_item_id', $prItem->id)->sum('qty');
            $prItem->update(['converted_qty' => $totalConverted]);
        }

        // 3. Determine overall PR conversion status (fully converted or short-closed items count as resolved)
        $pr->load('items');
        $totalItems = $pr->items->count();
        if ($totalItems === 0) {
            return;
        }

        $allResolved = $pr->items->every(function ($it) {
            $isShortClosed = $it->is_short_closed || ($it->remarks === 'Short Close');
            $convertedQty = (float)$it->converted_qty;
            $shortClosedQty = (float)$it->short_closed_qty;
            $reqQty = (float)$it->qty;
            return $isShortClosed || $convertedQty >= $reqQty || ($convertedQty + $shortClosedQty >= $reqQty);
        });

        $anyProgress = $pr->items->some(function ($it) {
            $isShortClosed = $it->is_short_closed || ($it->remarks === 'Short Close');
            return (float)$it->converted_qty > 0 || $isShortClosed;
        });

        if ($allResolved) {
            $pr->update([
                'status'       => 'converted',
                'converted_at' => $pr->converted_at ?? now(),
            ]);
        } elseif ($anyProgress) {
            $pr->update([
                'status' => 'partially_converted',
            ]);
        } else {
            // Revert status if zero items have been converted or short closed
            if (in_array($pr->status, ['converted', 'partially_converted'])) {
                $pr->update([
                    'status' => 'submitted',
                ]);
            }
        }
    }
}

