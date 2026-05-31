<?php

namespace App\Services;

use App\Models\TatRecord;

class TatService
{
    public function stamp(int $poId, string $field, $timestamp): void
    {
        TatRecord::updateOrCreate(
            ['po_id' => $poId],
            [$field => $timestamp]
        );
    }
}
