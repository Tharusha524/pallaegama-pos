<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PostGrnReceiveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_no' => 'required|integer|exists:purch_orders,order_no',
            'reference' => 'nullable|string|max:60',
            'delivery_date' => 'required|date',
            'loc_code' => 'nullable|string|exists:inventory_locations,loc_code',
            'comments' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.po_detail_item' => 'required|integer',
            'lines.*.quantity' => 'required|numeric|min:0.0001',
            'lines.*.selling_price' => 'nullable|numeric|min:0',
            'lines.*.mrp_price' => 'nullable|numeric|min:0',
        ];
    }
}
