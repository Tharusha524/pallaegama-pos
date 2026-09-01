<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockTransferItem extends Model
{
    protected $table = 'stock_transfer_items';

    protected $fillable = ['stock_transfer_id', 'stock_id', 'quantity'];

    public function stock()
    {
        return $this->belongsTo(StockMaster::class, 'stock_id', 'stock_id');
    }
}
