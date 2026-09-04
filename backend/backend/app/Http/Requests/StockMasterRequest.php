<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StockMasterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // allow all authenticated users
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $id = $this->route('stock_master');

        return [

            'stock_id' => [
                'required',
                'string',
                'max:255',
                Rule::unique('stock_master', 'stock_id')->ignore($id, 'stock_id')
            ],

            'category_id' => 'required|integer|exists:item_category,category_id',
            'tax_type_id' => 'nullable|integer|exists:item_tax_types,id',
            'description' => 'required|string|max:255',
            'long_description' => 'required|string',
            'units' => 'required|integer|exists:item_units,id',
            'mb_flag' => 'required|integer|exists:item_type,id',

            'sales_account' => 'required|string|exists:chart_master,account_code',
            'cogs_account' => 'required|string|exists:chart_master,account_code',
            'inventory_account' => 'required|string|exists:chart_master,account_code',
            'adjustment_account' => 'required|string|exists:chart_master,account_code',
            'wip_account' => 'required|string|exists:chart_master,account_code',

            'cost_center_id' => 'nullable|integer',
            'cost_center2_id' => 'nullable|integer',
            'purchase_cost' => 'required|numeric|min:0',
            'salvage_value' => 'nullable|numeric|min:0',
            'useful_life_years' => 'nullable|integer|min:0|max:100',
            'material_cost' => 'required|numeric|min:0',
            'labour_cost' => 'required|numeric|min:0',
            'overhead_cost' => 'required|numeric|min:0',

            'inactive' => 'boolean',
            'no_sale' => 'boolean',
            'no_purchase' => 'boolean',
            'editable' => 'boolean',

            'depreciation_method' => 'nullable|string|size:1',
            'depreciation_rate' => 'required|numeric|min:0',
            'depreciation_factor' => 'required|numeric|min:0',
            'depreciation_start' => 'required|date',
            'depreciation_date' => 'required|date|after_or_equal:depreciation_start',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            'fa_class_id' => 'nullable|exists:stock_fa_class,fa_class_id',
        ];
    }
}
