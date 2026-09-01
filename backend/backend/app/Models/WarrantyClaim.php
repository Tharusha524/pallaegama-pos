<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WarrantyClaim extends Model
{
    protected $table = 'warranty_claims';

    protected $fillable = ['warranty_id', 'issue_description', 'status', 'resolution_notes', 'claim_date'];

    protected $casts = ['claim_date' => 'date'];

    public function warranty()
    {
        return $this->belongsTo(Warranty::class, 'warranty_id');
    }
}
