<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorDocument extends Model
{
    protected $fillable = [
        'vendor_id', 'document_type', 'file_name', 'original_name', 'file_path', 'size', 'uploaded_by',
    ];

    public function vendor(): BelongsTo { return $this->belongsTo(Vendor::class); }
    public function uploadedBy(): BelongsTo { return $this->belongsTo(User::class, 'uploaded_by'); }
}
