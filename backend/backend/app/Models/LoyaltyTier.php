<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyTier extends Model
{
    protected $table = 'loyalty_tiers';

    protected $fillable = [
        'tier_name',
        'min_spend_threshold',
        'points_earn_rate',
        'redemption_rate',
        'benefits_description',
        'inactive',
    ];

    protected $casts = [
        'inactive' => 'boolean',
        'min_spend_threshold' => 'decimal:2',
        'points_earn_rate' => 'decimal:4',
        'redemption_rate' => 'decimal:4',
    ];
}
