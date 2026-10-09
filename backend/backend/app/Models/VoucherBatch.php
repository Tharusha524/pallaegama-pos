<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoucherBatch extends Model
{
    protected $table = 'voucher_batches';

    protected $fillable = [
        'batch_code', 'card_count', 'face_value_each', 'total_face_value',
        'expiry_date', 'note', 'created_by',
    ];

    protected $casts = ['expiry_date' => 'date'];

    public function vouchers()
    {
        return $this->hasMany(Voucher::class, 'batch_id');
    }
}
