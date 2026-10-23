<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PostSalesCreditNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'debtor_no' => 'required|integer|min:1',
            'branch_code' => 'required|integer|min:1',
            'tran_date' => 'required|date',
            'order_type' => 'required|integer|min:0',
            'ship_via' => 'nullable|integer',
            'freight_cost' => 'nullable|numeric|min:0',
            'from_stk_loc' => 'nullable|string|max:5',
            'write_off_account' => 'nullable|string|max:20',
            'source_invoice_trans_no' => 'nullable|integer|min:1',
            // Stock batches only: the invoice the goods were sold on, so returned
            // packets go back into the batch they came from (no allocation, no GL).
            'return_of_invoice' => 'nullable|integer|min:1',
            'comments' => 'nullable|string',
            'reference' => 'nullable|string|max:60',
            'cost_center_id' => 'nullable|integer',
            'lines' => 'required|array|min:1',
            'lines.*.stock_id' => 'required|string|max:20',
            'lines.*.quantity' => 'required|numeric|min:0.0001',
            'lines.*.unit_price' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.description' => 'nullable|string|max:200',
            'lines.*.src_id' => 'nullable|integer',
        ];
    }
}
