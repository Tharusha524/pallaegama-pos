<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PostGrnDirectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'supplier_id' => 'required|integer|exists:suppliers,supplier_id',
            'reference' => 'nullable|string|max:60',
            'delivery_date' => 'required|date',
            'into_stock_location' => 'required|string|exists:inventory_locations,loc_code',
            'delivery_address' => 'nullable|string',
            'tax_included' => 'boolean',
            'comments' => 'nullable|string',
            'total' => 'nullable|numeric',
            'cost_center_id' => 'nullable|integer',
            'lines' => 'required|array|min:1',
            'lines.*.item_code' => 'required|string|exists:stock_master,stock_id',
            'lines.*.description' => 'nullable|string',
            'lines.*.quantity' => 'required|numeric|min:0.0001',
            'lines.*.selling_price' => 'nullable|numeric|min:0',
            'lines.*.mrp_price' => 'nullable|numeric|min:0',
            'lines.*.unit_price' => 'required|numeric|min:0',
            'lines.*.delivery_date' => 'nullable|date',
        ];
    }
}
