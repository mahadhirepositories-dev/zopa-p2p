<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Stores CRUD permission flags for a named role × module pair.
 *
 * This is NOT Spatie's Permission model — it is a lightweight, flat
 * key/value store that the ZOPA Super Admin manages through the
 * Access Control screen. Existing AuthorizesRoles checks are unchanged.
 */
class RolePermission extends Model
{
    protected $fillable = [
        'role',
        'module',
        'can_view',
        'can_create',
        'can_edit',
        'can_delete',
    ];

    protected $casts = [
        'can_view'   => 'boolean',
        'can_create' => 'boolean',
        'can_edit'   => 'boolean',
        'can_delete' => 'boolean',
    ];
}
