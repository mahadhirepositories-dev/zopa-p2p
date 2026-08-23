<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SourcingRemark extends Model
{
    protected $fillable = [
        'sourcing_request_id',
        'user_id',
        'remark',
    ];

    public function sourcingRequest(): BelongsTo
    {
        return $this->belongsTo(SourcingRequest::class, 'sourcing_request_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
