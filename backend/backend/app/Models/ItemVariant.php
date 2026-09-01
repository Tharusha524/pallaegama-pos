<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemVariant extends Model
{
    protected $table = 'item_variants';

    protected $fillable = ['stock_id', 'variant_name', 'sku', 'barcode', 'price_adjustment', 'inactive'];

    public function stock()
    {
        return $this->belongsTo(StockMaster::class, 'stock_id', 'stock_id');
    }

    public function stockLevels()
    {
        return $this->hasMany(VariantStock::class, 'item_variant_id');
    }
}
