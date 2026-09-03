<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorOnboardingAttachment extends Model
{
    protected $fillable = [
        'response_id',
        'field_key',
        'document_type',
        'file_name',
        'original_name',
        'file_path',
        'mime_type',
        'size',
    ];

    public function response(): BelongsTo
    {
        return $this->belongsTo(VendorOnboardingResponse::class, 'response_id');
    }
}
