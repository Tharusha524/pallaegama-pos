<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyCard extends Model
{
    protected $table = 'loyalty_cards';

    protected $fillable = [
        'debtor_no',
        'card_no',
        'issue_date',
        'loyalty_tier_id',
        'points_balance',
        'status',
    ];

    protected $casts = [
        'points_balance' => 'decimal:2',
        'issue_date' => 'date',
    ];

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }

    public function tier()
    {
        return $this->belongsTo(LoyaltyTier::class, 'loyalty_tier_id');
    }
}
