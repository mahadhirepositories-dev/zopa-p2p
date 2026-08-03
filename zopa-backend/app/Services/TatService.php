<?php

namespace App\Services;

use App\Models\TatRecord;

class TatService
{
    public function stamp(int $entityId, string $field, $timestamp, string $type = 'po'): void
    {
        $key = ($type === 'pr') ? ['pr_id' => $entityId] : ['po_id' => $entityId];

        TatRecord::updateOrCreate(
            $key,
            [$field => $timestamp]
        );
    }

    public function stampPr(int $prId, string $field, $timestamp): void
    {
        $this->stamp($prId, $field, $timestamp, 'pr');
    }
}
