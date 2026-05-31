<?php

namespace App\Services;

use App\Models\ActivityLog;

class ActivityLogService
{
    /**
     * Record an activity entry.
     *
     * @param string $entityType  PR | PO | GRN | INVOICE
     * @param int    $entityId
     * @param string $action      created | submitted | approved | rejected | returned |
     *                            rfq_created | rfq_approved | converted | delivered |
     *                            invoiced | payment_released | cancelled | updated | deleted
     * @param array  $meta        Optional key-value context (status, comments, amount…)
     * @param int|null $tenantId  Falls back to app('currentTenant')->id when null
     */
    public function log(
        string $entityType,
        int $entityId,
        string $action,
        array $meta = [],
        ?int $tenantId = null
    ): void {
        try {
            $tid = $tenantId ?? (app()->bound('currentTenant') ? app('currentTenant')->id : null);

            ActivityLog::create([
                'tenant_id'   => $tid,
                'entity_type' => strtoupper($entityType),
                'entity_id'   => $entityId,
                'user_id'     => auth()->id(),
                'action'      => $action,
                'meta'        => $meta ?: null,
                'created_at'  => now(),
            ]);
        } catch (\Throwable) {
            // Never let logging break the main flow
        }
    }

    /**
     * Fetch the activity timeline for an entity, newest first.
     */
    public function forEntity(string $entityType, int $entityId): \Illuminate\Support\Collection
    {
        return ActivityLog::with('user:id,name')
            ->where('entity_type', strtoupper($entityType))
            ->where('entity_id', $entityId)
            ->orderByDesc('created_at')
            ->get();
    }
}
