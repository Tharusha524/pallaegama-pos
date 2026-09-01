<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfferRedemption extends Model
{
    protected $table = 'offer_redemptions';

    protected $fillable = [
        'offer_id',
        'debtor_no',
        'debtor_trans_no',
        'debtor_trans_type',
        'discount_amount',
        'redeemed_at',
    ];

    protected $casts = [
        'discount_amount' => 'decimal:2',
        'redeemed_at' => 'date',
    ];

    public function offer()
    {
        return $this->belongsTo(Offer::class, 'offer_id');
    }

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }
}
