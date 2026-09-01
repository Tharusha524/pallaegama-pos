<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Voucher extends Model
{
    protected $table = 'vouchers';

    protected $fillable = ['voucher_code', 'debtor_no', 'face_value', 'balance', 'issue_date', 'expiry_date', 'note', 'status'];

    protected $casts = ['issue_date' => 'date', 'expiry_date' => 'date'];

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }

    public function redemptions()
    {
        return $this->hasMany(VoucherRedemption::class, 'voucher_id');
    }
}
