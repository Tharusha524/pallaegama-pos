<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PosSetting extends Model
{
    protected $table = 'pos_settings';

    protected $fillable = ['key', 'value'];
    public $timestamps = true;
}
