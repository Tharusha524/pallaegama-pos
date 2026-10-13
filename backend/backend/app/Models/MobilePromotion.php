<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class MobilePromotion extends Model
{
    protected $fillable = [
        'title', 'description', 'promo_type', 'discount_type', 'discount_value',
        'valid_from', 'valid_to', 'image_path', 'is_active', 'sort_order',
        'sms_sent_at', 'sms_sent_count',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'discount_value' => 'float',
        'valid_from' => 'date:Y-m-d',
        'valid_to' => 'date:Y-m-d',
        'sms_sent_at' => 'datetime',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? url('api/storage-file/' . $this->image_path) : null;
    }

    public function scopeCurrentlyActive(Builder $query): Builder
    {
        $today = now()->toDateString();

        return $query->where('is_active', true)
            ->whereDate('valid_from', '<=', $today)
            ->whereDate('valid_to', '>=', $today);
    }
}
