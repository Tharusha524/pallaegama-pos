<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceTicket extends Model
{
    protected $table = 'service_tickets';

    protected $fillable = [
        'ticket_no', 'debtor_no', 'item_description', 'serial_no', 'issue_notes',
        'status', 'received_date', 'due_date', 'created_by',
    ];

    protected $casts = ['received_date' => 'date', 'due_date' => 'date'];

    public function debtor()
    {
        return $this->belongsTo(DebtorsMaster::class, 'debtor_no', 'debtor_no');
    }
}
