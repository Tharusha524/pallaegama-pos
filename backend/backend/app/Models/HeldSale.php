<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HeldSale extends Model
{
    protected $table = 'held_sales';

    protected $fillable = ['hold_reference', 'user_id', 'debtor_no', 'cart_snapshot'];

    protected $casts = ['cart_snapshot' => 'array'];
}
