<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfflineEntry extends Model
{
    protected $table = 'offline_entries';

    protected $fillable = [
        'entry_type', 'entry_date', 'debtor_no', 'supplier_id',
        'total_amount', 'payment_breakdown', 'notes', 'recorded_by',
    ];

    protected $casts = ['payment_breakdown' => 'array', 'entry_date' => 'date'];

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'supplier_id');
    }
}
