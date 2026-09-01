<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Warranty extends Model
{
    protected $table = 'warranties';

    protected $fillable = [
        'stock_id', 'debtor_trans_no', 'debtor_trans_type', 'warranty_policy_id',
        'serial_no', 'warranty_start', 'warranty_end', 'status',
    ];

    protected $casts = ['warranty_start' => 'date', 'warranty_end' => 'date'];

    public function stock()
    {
        return $this->belongsTo(StockMaster::class, 'stock_id', 'stock_id');
    }

    public function policy()
    {
        return $this->belongsTo(WarrantyPolicy::class, 'warranty_policy_id');
    }

    public function claims()
    {
        return $this->hasMany(WarrantyClaim::class, 'warranty_id');
    }
}
