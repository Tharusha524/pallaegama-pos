<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockDamage extends Model
{
    protected $table = 'stock_damages';

    protected $fillable = [
        'stock_id',
        'loc_code',
        'quantity',
        'reason',
        'damage_date',
        'recorded_by',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'damage_date' => 'date',
    ];

    public function stock()
    {
        return $this->belongsTo(StockMaster::class, 'stock_id', 'stock_id');
    }
}
