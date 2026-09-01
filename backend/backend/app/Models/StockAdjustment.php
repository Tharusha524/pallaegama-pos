<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
    protected $table = 'stock_adjustments';

    protected $fillable = [
        'stock_id', 'loc_code', 'movement_type', 'quantity_before',
        'quantity_moved', 'quantity_after', 'reason', 'notes', 'recorded_by',
    ];

    public function stock()
    {
        return $this->belongsTo(StockMaster::class, 'stock_id', 'stock_id');
    }
}
