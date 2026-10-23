<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PostSupplierInvoiceDirectRequest extends FormRequest
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
            'supp_reference' => 'nullable|string|max:60',
            'trans_date' => 'required|date',
            'due_date' => 'nullable|date',
            'into_stock_location' => 'required|string|exists:inventory_locations,loc_code',
            'delivery_address' => 'nullable|string',
            'tax_included' => 'boolean',
            'fixed_asset' => 'boolean',
            'cost_center_id' => 'nullable|integer',
            'comments' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_code' => 'required|string|exists:stock_master,stock_id',
            'lines.*.description' => 'nullable|string',
            'lines.*.quantity' => 'required|numeric|min:0.0001',
            'lines.*.selling_price' => 'nullable|numeric|min:0',
            'lines.*.mrp_price' => 'nullable|numeric|min:0',
            'lines.*.unit_price' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
        ];
    }
}
