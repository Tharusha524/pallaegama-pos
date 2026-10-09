<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Voucher extends Model
{
    protected $table = 'vouchers';

    protected $fillable = [
        'batch_id', 'voucher_code', 'debtor_no', 'face_value', 'balance',
        'issue_date', 'expiry_date', 'note', 'status',
        'issued_debtor_trans_no', 'issued_debtor_trans_type',
        'activated_by', 'activated_at', 'created_by',
    ];

    protected $casts = [
        'issue_date' => 'date',
        'expiry_date' => 'date',
        'activated_at' => 'date',
    ];

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }

    public function batch()
    {
        return $this->belongsTo(VoucherBatch::class, 'batch_id');
    }

    public function redemptions()
    {
        return $this->hasMany(VoucherRedemption::class, 'voucher_id');
    }
}
