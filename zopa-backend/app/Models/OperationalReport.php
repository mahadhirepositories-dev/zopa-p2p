<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OperationalReport extends Model
{
    use HasFactory;

    protected $table = 'operational_reports';

    protected $fillable = [
        'tenant_id',
        'created_by',
        'title',
        'period_start',
        'period_end',
        'status',
        'metrics_data',
        'open_prs_data',
        'pending_pos_data',
        'deliveries_data',
        'tasks_data',
        'client_approver_email',
        'client_approver_name',
        'cc_emails',
        'notes',
        'sent_at',
        'sent_by',
        'pdf_path',
    ];

    protected $casts = [
        'period_start'    => 'date',
        'period_end'      => 'date',
        'sent_at'         => 'datetime',
        'metrics_data'    => 'array',
        'open_prs_data'   => 'array',
        'pending_pos_data'=> 'array',
        'deliveries_data' => 'array',
        'tasks_data'      => 'array',
        'cc_emails'       => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
