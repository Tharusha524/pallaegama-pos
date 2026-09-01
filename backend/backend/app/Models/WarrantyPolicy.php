<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WarrantyPolicy extends Model
{
    protected $table = 'warranty_policies';

    protected $fillable = ['policy_name', 'period_value', 'period_unit', 'terms'];
}
