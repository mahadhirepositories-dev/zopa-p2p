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

    public function sourcingRequests(): HasMany
    {
        return $this->hasMany(SourcingRequest::class, 'pr_id');
    }

    public static function stemWord(string $word): string
    {
        $w = strtolower(trim($word));
        if (str_ends_with($w, 'ies') && strlen($w) > 4) {
            $w = substr($w, 0, -3) . 'y';
        } elseif (str_ends_with($w, 'es') && strlen($w) > 4) {
            $w = substr($w, 0, -2);
        } elseif (str_ends_with($w, 's') && !str_ends_with($w, 'ss') && strlen($w) > 3) {
            $w = substr($w, 0, -1);
        }
        return $w;
    }

    public static function cleanItemDesc(?string $desc): string
    {
        if (!$desc) return '';
        $cleaned = preg_replace('/\s*[-–]?\s*\((?:pack\s+of\s+\d+|\d+\s*\*\s*\d+|\d+\s*nos|\d+\s*ml|\d+\s*ltr|\d+\s*gms?)\)/i', '', $desc);
        $cleaned = preg_replace('/\s*[-–]\s*(?:pack\s+of\s+\d+|\d+\s*ml|\d+\s*ltr|\d+\s*gms?)/i', '', $cleaned);
        $cleaned = preg_replace('/\d+\*\d+/', '', $cleaned);
        $cleaned = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $cleaned));
        $cleaned = preg_replace('/(strip|card|tube|slip|slide|bottle|container|syringe|glove|mask|swab|chair|table|pillow|tray|dustbin)s/i', '$1', $cleaned);
        // Common pharmaceutical and laboratory spelling variations
        $cleaned = str_replace('planetube', 'plaintube', $cleaned);
        $cleaned = str_replace('hyderoxide', 'hydroxide', $cleaned);
        $cleaned = str_replace('methylcobalmin', 'methylcobalamin', $cleaned);
        $cleaned = str_replace('contanier', 'container', $cleaned);
        $cleaned = str_replace('oncal', 'oncall', $cleaned);
        return $cleaned;
    }

    public static function matchScore(?string $poDesc, ?string $prDesc): int
    {
        if (!$poDesc || !$prDesc) return 0;
        $cPo = strtolower(preg_replace('/[^a-zA-Z0-9]/', ' ', $poDesc));
        $cPr = strtolower(preg_replace('/[^a-zA-Z0-9]/', ' ', $prDesc));

        $poRawWords = array_filter(explode(' ', $cPo));
        $prRawWords = array_filter(explode(' ', $cPr));

        // Stem all words
        $poWords = array_map([self::class, 'stemWord'], $poRawWords);
        $prWords = array_map([self::class, 'stemWord'], $prRawWords);

        // Form types: tablet, susp, syrup, cap, capsule, inj, strip, card, tube, bottle, drop
        $forms = ['tablet', 'tab', 'susp', 'suspension', 'syrup', 'syp', 'cap', 'capsule', 'inj', 'injection', 'strip', 'card', 'tube', 'bottle', 'gel', 'mask', 'glove', 'cream', 'ointment'];
        $poForms = array_intersect($poWords, $forms);
        $prForms = array_intersect($prWords, $forms);

        // If both specify a form and forms conflict, score = 0 (e.g. tablet vs susp)
        if (!empty($poForms) && !empty($prForms)) {
            $formMatch = false;
            foreach ($poForms as $pf) {
                foreach ($prForms as $rf) {
                    if ($pf === $rf || str_starts_with($pf, $rf) || str_starts_with($rf, $pf)) {
                        $formMatch = true;
                        break 2;
                    }
                }
            }
            if (!$formMatch) {
                return 0; // Conflict! Tablet does not match Susp!
            }
        }

        // Extract numbers (dosages, sizes): e.g. 400, 10, 500, 250, 20
        preg_match_all('/\d+/', $poDesc, $mPo);
        preg_match_all('/\d+/', $prDesc, $mPr);
        $poNums = $mPo[0];
        $prNums = $mPr[0];

        $ignore = ['pack', 'of', 'nos', 'box', 'and', 'the', 'for', 'in', 'with', 'sd', 'biosensor', 'f200'];
        $poKeyWords = array_diff($poWords, $ignore);
        $prKeyWords = array_diff($prWords, $ignore);

        $sharedWords = array_intersect($poKeyWords, $prKeyWords);
        $score = count($sharedWords) * 10;

        $sharedNums = array_intersect($poNums, $prNums);
        $score += count($sharedNums) * 20;

        if (!empty($poNums) && !empty($prNums) && empty($sharedNums)) {
            $score -= 15;
        }

        return max(0, $score);
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

        // 1. If this PR has a single linked PO with matching item count (e.g. PR2 with 78 items & PO52 with 78 items), map 1-to-1 by sno
        $singlePo = ($allPos->count() === 1) ? $allPos->first() : null;
        if ($singlePo && $singlePo->items->count() === $prItems->count()) {
            foreach ($singlePo->items as $poIt) {
                $matchingPr = $prItems->firstWhere('sno', $poIt->sno);
                if ($matchingPr && $poIt->pr_item_id !== $matchingPr->id) {
                    $poIt->update(['pr_item_id' => $matchingPr->id]);
                }
            }
        } else {
            // General multi-pass matching for multi-PO or split PRs
            foreach ($poItems as $poItem) {
                // If this PO item is already linked to an item of THIS PR, preserve it!
                if ($poItem->pr_item_id && in_array($poItem->pr_item_id, $prItemIds)) {
                    continue;
                }

                $cPo = self::cleanItemDesc($poItem->description);
                $matchedPrItem = null;

                // Strategy A: Match by product_id if set
                if ($poItem->product_id) {
                    $matchedPrItem = $prItems->firstWhere('product_id', $poItem->product_id);
                }

                // Strategy B: Exact cleaned description match
                if (!$matchedPrItem && !empty($cPo)) {
                    $exactMatches = $prItems->filter(function ($prIt) use ($cPo) {
                        $cPr = PurchaseRequisition::cleanItemDesc($prIt->description);
                        return !empty($cPr) && $cPr === $cPo;
                    });

                    if ($exactMatches->count() > 0) {
                        $matchedPrItem = $exactMatches->first(function ($prIt) use ($poItems) {
                            $currConverted = (float) $poItems->where('pr_item_id', $prIt->id)->sum('qty');
                            return $currConverted < (float) $prIt->qty;
                        }) ?? $exactMatches->first();
                    }
                }

                // Strategy C: Scored matching (respects dosage, form, keywords)
                if (!$matchedPrItem) {
                    $candidates = [];
                    foreach ($prItems as $prIt) {
                        $score = self::matchScore($poItem->description ?? '', $prIt->description ?? '');
                        if ($score > 0) {
                            $candidates[] = ['pr' => $prIt, 'score' => $score];
                        }
                    }

                    if (!empty($candidates)) {
                        usort($candidates, fn($a, $b) => $b['score'] <=> $a['score']);
                        $topScore = $candidates[0]['score'];
                        $topCandidates = array_filter($candidates, fn($c) => $c['score'] === $topScore);

                        // Pick unfulfilled candidate first
                        foreach ($topCandidates as $c) {
                            $currConverted = (float) $poItems->where('pr_item_id', $c['pr']->id)->sum('qty');
                            if ($currConverted < (float) $c['pr']->qty) {
                                $matchedPrItem = $c['pr'];
                                break;
                            }
                        }
                        if (!$matchedPrItem) {
                            $matchedPrItem = $candidates[0]['pr'];
                        }
                    }
                }

                // Strategy D: Match by sno if description compatible
                if (!$matchedPrItem) {
                    $matchBySno = $prItems->firstWhere('sno', $poItem->sno);
                    if ($matchBySno) {
                        $cPr = self::cleanItemDesc($matchBySno->description);
                        if (empty($cPr) || empty($cPo) || str_contains($cPo, $cPr) || str_contains($cPr, $cPo)) {
                            $matchedPrItem = $matchBySno;
                        }
                    }
                }

                // Strategy E: Match by exact quantity among unfulfilled PR items
                if (!$matchedPrItem && (float)$poItem->qty > 0) {
                    $unfulfilledSameQty = $prItems->filter(function ($prIt) use ($poItem, $poItems) {
                        $currConverted = (float) $poItems->where('pr_item_id', $prIt->id)->sum('qty');
                        return $currConverted < (float) $prIt->qty && abs((float)$prIt->qty - (float)$poItem->qty) < 0.001;
                    });
                    if ($unfulfilledSameQty->count() === 1) {
                        $matchedPrItem = $unfulfilledSameQty->first();
                    }
                }

                // Strategy F: Unconditional SNO fallback for unfulfilled PR item
                if (!$matchedPrItem) {
                    $snoPr = $prItems->firstWhere('sno', $poItem->sno);
                    if ($snoPr) {
                        $currConverted = (float) $poItems->where('pr_item_id', $snoPr->id)->sum('qty');
                        if ($currConverted < (float) $snoPr->qty) {
                            $matchedPrItem = $snoPr;
                        }
                    }
                }

                if ($matchedPrItem && $poItem->pr_item_id !== $matchedPrItem->id) {
                    $poItem->update(['pr_item_id' => $matchedPrItem->id]);
                }
            }
        }

        // Refresh poItems list after auto-linking
        $poItems = $allPos->fresh(['items'])->pluck('items')->flatten();

        // 2. Recalculate converted_qty on each PR item
        foreach ($pr->items as $prItem) {
            $totalConverted = (float) $poItems->where('pr_item_id', $prItem->id)->sum('qty');
            if ($totalConverted > 0) {
                $prItem->update(['converted_qty' => max((float)$prItem->converted_qty, $totalConverted)]);
            }
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
            return $isShortClosed || $convertedQty >= $reqQty || ($convertedQty >= $reqQty - 1.0) || ($convertedQty + $shortClosedQty >= $reqQty);
        });

        $anyProgress = $pr->items->some(function ($it) {
            $isShortClosed = $it->is_short_closed || ($it->remarks === 'Short Close');
            return (float)$it->converted_qty > 0 || $isShortClosed;
        });

        $hasShortClosedItems = $pr->items->some(fn($it) => $it->is_short_closed || ($it->remarks === 'Short Close'));
        $hasConvertedItems = $pr->items->some(fn($it) => (float)$it->converted_qty > 0);
        $isShortClosedPr = $pr->status === 'short_closed' || !empty($pr->short_closed_at) || !empty($pr->short_close_reason);

        if ($allResolved) {
            if ($isShortClosedPr || ($hasShortClosedItems && $hasConvertedItems)) {
                $pr->update(['status' => 'short_closed', 'converted_at' => $pr->converted_at ?? now()]);
            } elseif (!in_array($pr->status, ['short_close_pending_l1', 'short_close_pending_l2', 'short_close_pending_l3'])) {
                $pr->update([
                    'status'       => 'converted',
                    'converted_at' => $pr->converted_at ?? now(),
                ]);
            }
        } elseif ($anyProgress) {
            if ($isShortClosedPr) {
                $pr->update(['status' => 'short_closed']);
            } elseif (!in_array($pr->status, ['short_closed', 'converted', 'short_close_pending_l1', 'short_close_pending_l2', 'short_close_pending_l3'])) {
                $pr->update([
                    'status' => 'partially_converted',
                ]);
            }
        } else {
            // Revert status if zero items have been converted or short closed
            if (in_array($pr->status, ['partially_converted'])) {
                $pr->update([
                    'status' => 'submitted',
                ]);
            }
        }
    }
}

