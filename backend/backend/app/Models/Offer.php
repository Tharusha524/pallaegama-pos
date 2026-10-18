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
        'image_path',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? url('api/storage-file/' . $this->image_path) : null;
    }

    protected $casts = [
        'discount_value' => 'decimal:2',
        'min_purchase_amount' => 'decimal:2',
        // Plain Y-m-d in JSON: a bare 'date' cast serialises as UTC midnight
        // (e.g. 2026-09-03T18:30Z for 2026-09-04 in Colombo), shown a day early.
        'valid_from' => 'date:Y-m-d',
        'valid_to' => 'date:Y-m-d',
    ];

    public function redemptions()
    {
        return $this->hasMany(OfferRedemption::class, 'offer_id');
    }
}
