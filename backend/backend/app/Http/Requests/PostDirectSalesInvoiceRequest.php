<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PostDirectSalesInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function failedValidation(\Illuminate\Contracts\Validation\Validator $validator)
    {
        \Illuminate\Support\Facades\Log::error('Validation failed for Direct Invoice', $validator->errors()->toArray());
        parent::failedValidation($validator);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'debtor_no' => 'required|integer|min:1',
            'branch_code' => 'required|integer|min:1',
            'tran_date' => 'required|date',
            'due_date' => 'nullable|date',
            'order_type' => 'required|integer|min:0',
            'ship_via' => 'nullable|integer',
            'payment_terms' => 'nullable|integer',
            'freight_cost' => 'nullable|numeric|min:0',
            'from_stk_loc' => 'nullable|string|max:5',
            'cost_center_id' => 'nullable|integer',
            'cost_center2_id' => 'nullable|integer',
            'comments' => 'nullable|string',
            'reference' => 'nullable|string|max:60',
            'customer_ref' => 'nullable|string|max:60',
            'delivery_address' => 'nullable|string',
            'deliver_to' => 'nullable|string',
            'cash_sale' => 'nullable|boolean',
            'bank_account_id' => 'nullable|integer',
            'payments' => 'nullable|array',
            'payments.*.bank_account_id' => 'required_with:payments|integer',
            'payments.*.amount' => 'required_with:payments|numeric|min:0.01',
            'lines' => 'required|array|min:1',
            'lines.*.stock_id' => 'required|string|max:20',
            'lines.*.quantity' => 'required|numeric|min:0.0001',
            'lines.*.unit_price' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.description' => 'nullable|string|max:200',
        ];
    }
}
