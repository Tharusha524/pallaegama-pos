<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryAuditItem extends Model
{
    protected $table = 'inventory_audit_items';

    protected $fillable = ['inventory_audit_id', 'stock_id', 'system_quantity', 'counted_quantity', 'variance'];

    public function stock()
    {
        return $this->belongsTo(StockMaster::class, 'stock_id', 'stock_id');
    }
}
