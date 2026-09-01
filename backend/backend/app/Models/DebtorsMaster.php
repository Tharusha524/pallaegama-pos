<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DebtorsMaster extends Model
{
    use HasFactory;

    protected $table = 'debtors_master';
    protected $primaryKey = 'debtor_no';

    protected $fillable = [
        'name',
        'debtor_ref',
        'address',
        'mobile',
        'email',
        'date_of_birth',
        'last_purchase_date',
        'gst',
        'curr_code',
        'sales_type',
        'cost_center_id',
        'cost_center2_id',
        'credit_status',
        'payment_terms',
        'discount',
        'pymt_discount',
        'credit_limit',
        'notes',
        'inactive',
    ];

    protected $casts = [
        'inactive' => 'boolean',
        'discount' => 'decimal:2',
        'pymt_discount' => 'decimal:2',
        'credit_limit' => 'float',
        'date_of_birth' => 'date',
        'last_purchase_date' => 'date',
    ];

    protected $with = ['currency', 'salesType', 'creditStatus', 'paymentTerm'];

    public function currency()
    {
        return $this->belongsTo(Currency::class, 'curr_code', 'currency_abbreviation');
    }

    public function salesType()
    {
        return $this->belongsTo(SalesType::class, 'sales_type', 'id');
    }

    public function creditStatus()
    {
        return $this->belongsTo(CreditStatusSetup::class, 'credit_status', 'id');
    }

    public function paymentTerm()
    {
        return $this->belongsTo(PaymentTerm::class, 'payment_terms', 'terms_indicator');
    }

    public function branches()
    {
        return $this->hasMany(CustomerBranch::class, 'debtor_no', 'debtor_no');
    }

    public function salesOrders()
    {
        return $this->hasMany(SalesOrder::class, 'debtor_no', 'debtor_no');
    }

    public function loyaltyCard()
    {
        return $this->hasOne(LoyaltyCard::class, 'debtor_no', 'debtor_no');
    }
}
