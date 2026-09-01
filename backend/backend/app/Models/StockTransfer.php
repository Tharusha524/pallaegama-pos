<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockTransfer extends Model
{
    protected $table = 'stock_transfers';

    protected $fillable = ['transfer_ref', 'from_loc_code', 'to_loc_code', 'status', 'created_by', 'dispatched_at', 'received_at'];

    protected $casts = ['dispatched_at' => 'datetime', 'received_at' => 'datetime'];

    public function items()
    {
        return $this->hasMany(StockTransferItem::class, 'stock_transfer_id');
    }
}
