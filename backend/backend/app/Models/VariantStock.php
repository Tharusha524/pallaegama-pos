<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VariantStock extends Model
{
    protected $table = 'variant_stock';

    protected $fillable = ['item_variant_id', 'loc_code', 'quantity'];
}
