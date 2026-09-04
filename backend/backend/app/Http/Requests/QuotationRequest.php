<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class QuotationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'quotation_number' => 'required|string|unique:quotations,quotation_number',
            'trans_type' => 'required|integer|exists:trans_types,trans_type',
            'debtor_no' => 'required|integer|exists:debtors_master,debtor_no',
            'branch_code' => 'nullable|string',
            'reference' => 'nullable|string',
            'customer_ref' => 'nullable|string',
            'comments' => 'nullable|string',
            'quotation_date' => 'required|date_format:Y-m-d H:i:s',
            'delivery_date' => 'nullable|date_format:Y-m-d H:i:s',
            // Was missing entirely — silently stripped by ->validated(), so
            // the FA-quotation path always fell back to a hardcoded order_type
            // of 1, which doesn't exist in sales_types, breaking every save.
            'order_type' => 'nullable|integer|exists:sales_types,id',
            'ship_via' => 'nullable|string',
            'delivery_address' => 'nullable|string',
            'contact_phone' => 'nullable|string',
            'contact_email' => 'nullable|email',
            'freight_cost' => 'nullable|numeric|min:0',
            'from_stk_loc' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'details' => 'required|array|min:1',
            'details.*.stk_code' => 'required|string|exists:stock_master,stock_id',
            'details.*.trans_type' => 'required|integer|exists:trans_types,trans_type',
            'details.*.description' => 'nullable|string',
            'details.*.quantity' => 'required|numeric|min:0.01',
            'details.*.unit_price' => 'required|numeric|min:0',
            'details.*.discount_percent' => 'nullable|numeric|min:0|max:100',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'quotation_number.unique' => 'This quotation number already exists.',
            'details.required' => 'At least one quotation detail is required.',
            'details.min' => 'At least one quotation detail is required.',
        ];
    }
}
