<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WinBackCampaign extends Model
{
    protected $table = 'win_back_campaigns';

    protected $fillable = [
        'debtor_no',
        'offer_id',
        'channel',
        'sent_at',
        'redeemed',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'redeemed' => 'boolean',
    ];

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }

    public function offer()
    {
        return $this->belongsTo(Offer::class, 'offer_id');
    }
}
