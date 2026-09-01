<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyPointsTransaction extends Model
{
    protected $table = 'loyalty_points_transactions';

    protected $fillable = [
        'debtor_no',
        'debtor_trans_no',
        'debtor_trans_type',
        'points_earned',
        'points_redeemed',
        'balance_after',
        'transaction_date',
    ];

    protected $casts = [
        'points_earned' => 'decimal:2',
        'points_redeemed' => 'decimal:2',
        'balance_after' => 'decimal:2',
        'transaction_date' => 'date',
    ];

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }
}
