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

        // 1. Intelligently match & re-link PO items to PR items based on Product ID & Description stems
        foreach ($poItems as $poItem) {
            $poDesc = trim($poItem->description ?? '');
            $normPoDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $poDesc));

            $matchedPrItem = null;

            // Strategy 1: Match by product_id if set
            if ($poItem->product_id) {
                $matchedPrItem = $pr->items->firstWhere('product_id', $poItem->product_id);
            }

            // Strategy 2: Match by exact or token stem description
            if (!$matchedPrItem && !empty($normPoDesc)) {
                // Try exact normalized match
                $matchedPrItem = $pr->items->first(function ($prIt) use ($normPoDesc) {
                    $normPrDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $prIt->description ?? ''));
                    return !empty($normPrDesc) && $normPrDesc === $normPoDesc;
                });

                // Try substring/stem matching (e.g. "malaria" in "malariacardspackof50", "hb" in "truehbstripbox")
                if (!$matchedPrItem) {
                    $matchedPrItem = $pr->items->first(function ($prIt) use ($normPoDesc) {
                        $normPrDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $prIt->description ?? ''));
                        if (empty($normPrDesc)) return false;

                        if (str_contains($normPoDesc, $normPrDesc) || str_contains($normPrDesc, $normPoDesc)) return true;

                        // Token stems (e.g. malaria, hb, rbs, typhoid, upt, dengue, lancet, cotton, spirit)
                        $prStem = strtolower(trim(preg_replace('/(cards?|strips?|box|packs?|packof[0-9]+|tablets?|inj|solution|container)s?/i', '', $prIt->description ?? '')));
                        $prStemNorm = preg_replace('/[^a-zA-Z0-9]/', '', $prStem);

                        if (!empty($prStemNorm) && strlen($prStemNorm) >= 2 && str_contains($normPoDesc, $prStemNorm)) {
                            return true;
                        }

                        similar_text($normPrDesc, $normPoDesc, $percent);
                        return $percent >= 60;
                    });
                }
            }

            // Strategy 3: Match by sno ONLY if descriptions share stem or no other match
            if (!$matchedPrItem) {
                $matchBySno = $pr->items->firstWhere('sno', $poItem->sno);
                if ($matchBySno) {
                    $normPrDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $matchBySno->description ?? ''));
                    similar_text($normPrDesc, $normPoDesc, $percent);
                    if ($percent >= 35 || empty($normPrDesc) || empty($normPoDesc)) {
                        $matchedPrItem = $matchBySno;
                    }
                }
            }

            if ($matchedPrItem && $poItem->pr_item_id !== $matchedPrItem->id) {
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

