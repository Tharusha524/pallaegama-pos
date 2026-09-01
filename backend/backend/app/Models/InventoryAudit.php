<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryAudit extends Model
{
    protected $table = 'inventory_audits';

    protected $fillable = ['audit_ref', 'loc_code', 'notes', 'status', 'created_by', 'completed_at'];

    protected $casts = ['completed_at' => 'datetime'];

    public function items()
    {
        return $this->hasMany(InventoryAuditItem::class, 'inventory_audit_id');
    }
}
