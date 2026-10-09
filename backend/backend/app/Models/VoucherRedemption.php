<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoucherRedemption extends Model
{
    protected $table = 'voucher_redemptions';

    protected $fillable = [
        'voucher_id', 'debtor_trans_no', 'debtor_trans_type',
        'amount_used', 'payment_trans_no', 'redeemed_at', 'cashier', 'note',
    ];

    protected $casts = ['redeemed_at' => 'date'];
}
