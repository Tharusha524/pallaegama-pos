<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PosShift extends Model
{
    protected $table = 'pos_shifts';

    protected $fillable = [
        'user_id',
        'sales_pos_id',
        'opening_float',
        'closing_expected',
        'closing_counted',
        'variance',
        'shift_start',
        'shift_end',
        'status',
        'notes',
    ];

    protected $casts = [
        'opening_float' => 'decimal:2',
        'closing_expected' => 'decimal:2',
        'closing_counted' => 'decimal:2',
        'variance' => 'decimal:2',
        'shift_start' => 'datetime',
        'shift_end' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function salesPos()
    {
        return $this->belongsTo(SalesPos::class, 'sales_pos_id');
    }
}
