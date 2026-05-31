<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApprovalConfig extends Model
{
    protected $fillable = [
        'cost_center_id', 'type', 'level', 'user_id', 'user_ids', 'amount_limit', 'is_active',
    ];

    protected $casts = [
        'amount_limit' => 'decimal:2',
        'is_active'    => 'boolean',
        'user_ids'     => 'array',
    ];

    /**
     * Resolved list of approver user IDs — prefers user_ids JSON array, falls back to single user_id.
     */
    public function getResolvedUserIdsAttribute(): array
    {
        if (!empty($this->user_ids)) {
            return $this->user_ids;
        }
        return $this->user_id ? [$this->user_id] : [];
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    /** Primary/legacy single approver */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** All users configured for this level */
    public function users()
    {
        $ids = $this->resolved_user_ids;
        return User::whereIn('id', $ids)->get();
    }
}
