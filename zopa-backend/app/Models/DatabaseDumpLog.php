<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DatabaseDumpLog extends Model
{
    use HasFactory;

    protected $table = 'database_dump_logs';

    protected $fillable = [
        'user_id',
        'user_name',
        'user_email',
        'file_name',
        'file_size_bytes',
        'format',
        'ip_address',
        'status',
        'error_message',
        'duration_ms',
    ];

    protected $casts = [
        'file_size_bytes' => 'integer',
        'duration_ms'     => 'integer',
        'created_at'      => 'datetime',
        'updated_at'      => 'datetime',
    ];

    protected $appends = [
        'formatted_size',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getFormattedSizeAttribute(): string
    {
        $bytes = (int) $this->file_size_bytes;
        if ($bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = floor(log($bytes, 1024));
        $i = min($i, count($units) - 1);

        return round($bytes / pow(1024, $i), 2) . ' ' . $units[$i];
    }
}
