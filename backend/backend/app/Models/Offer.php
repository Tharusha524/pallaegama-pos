<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Offer extends Model
{
    protected $table = 'offers';

    protected $fillable = [
        'offer_name',
        'coupon_code',
        'offer_type',
        'target_id',
        'discount_type',
        'discount_value',
        'valid_from',
        'valid_to',
        'min_purchase_amount',
        'max_total_uses',
        'max_uses_per_customer',
        'times_used',
        'status',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'min_purchase_amount' => 'decimal:2',
        'valid_from' => 'date',
        'valid_to' => 'date',
    ];

    public function redemptions()
    {
        return $this->hasMany(OfferRedemption::class, 'offer_id');
    }
}
