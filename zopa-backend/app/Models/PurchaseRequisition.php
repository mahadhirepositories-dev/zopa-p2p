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

        // 1. Auto-link unlinked PO items to PR items if pr_item_id is null
        foreach ($poItems as $poItem) {
            if (empty($poItem->pr_item_id)) {
                $normPoDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $poItem->description ?? ''));

                // Strategy A: Match by sno
                $match = $pr->items->firstWhere('sno', $poItem->sno);

                // Strategy B: Match by product_id if set
                if (!$match && $poItem->product_id) {
                    $match = $pr->items->firstWhere('product_id', $poItem->product_id);
                }

                // Strategy C: Match by fuzzy description similarity or substring
                if (!$match && !empty($normPoDesc)) {
                    $match = $pr->items->first(function ($prIt) use ($normPoDesc) {
                        $normPrDesc = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $prIt->description ?? ''));
                        if (empty($normPrDesc)) return false;
                        if ($normPrDesc === $normPoDesc) return true;
                        if (str_contains($normPoDesc, $normPrDesc) || str_contains($normPrDesc, $normPoDesc)) return true;
                        similar_text($normPrDesc, $normPoDesc, $percent);
                        return $percent >= 70;
                    });
                }

                if ($match) {
                    $poItem->update(['pr_item_id' => $match->id]);
                }
            }
        }

        // Refresh poItems list after auto-linking
        $poItems = $allPos->fresh(['items'])->pluck('items')->flatten();

        // 2. Recalculate converted_qty on each PR item
        foreach ($pr->items as $prItem) {
            $totalConverted = (float) $poItems->where('pr_item_id', $prItem->id)->sum('qty');
            if ($totalConverted == 0) {
                $poItemBySno = $poItems->firstWhere('sno', $prItem->sno);
                if ($poItemBySno) {
                    $poItemBySno->update(['pr_item_id' => $prItem->id]);
                    $totalConverted = (float) $poItemBySno->qty;
                }
            }
            $prItem->update(['converted_qty' => $totalConverted]);
        }

        // 3. Determine overall PR conversion status strictly from item conversion progress
        $pr->load('items');
        $totalItems = $pr->items->count();
        if ($totalItems === 0) {
            return;
        }

        $allConverted = $pr->items->every(fn($it) => (float)$it->converted_qty >= (float)$it->qty);
        $anyConverted = $pr->items->some(fn($it) => (float)$it->converted_qty > 0);

        if ($allConverted) {
            $pr->update([
                'status'       => 'converted',
                'converted_at' => $pr->converted_at ?? now(),
            ]);
        } elseif ($anyConverted) {
            $pr->update([
                'status' => 'partially_converted',
            ]);
        } else {
            // Revert status if zero items have been converted
            if (in_array($pr->status, ['converted', 'partially_converted'])) {
                $pr->update([
                    'status' => 'submitted',
                ]);
            }
        }
    }
}

