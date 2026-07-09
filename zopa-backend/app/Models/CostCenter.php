<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CostCenter extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'department_id', 'project_id',
        'location_id', 'annual_budget', 'budget_from', 'budget_to',
        'current_fiscal_year', 'is_active',
    ];

    protected $casts = [
        'annual_budget' => 'decimal:2',
        'budget_from' => 'date',
        'budget_to' => 'date',
        'is_active' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function approvalConfigs(): HasMany
    {
        return $this->hasMany(ApprovalConfig::class)->orderBy('level');
    }

    public function budgetLedger(): HasMany
    {
        return $this->hasMany(BudgetLedger::class);
    }

    public function users(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    public function locations(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Location::class);
    }
}
