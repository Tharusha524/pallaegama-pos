<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DebtorsMasterRequest extends FormRequest
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
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'debtor_ref' => 'required|string|max:30',
            'address' => 'nullable|string',
            'mobile' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'date_of_birth' => 'nullable|date',
            'last_purchase_date' => 'nullable|date',
            'gst' => 'nullable|string|max:55',
            'curr_code' => 'required|exists:currencies,currency_abbreviation',
            'sales_type' => 'required|exists:sales_types,id',
            'cost_center_id' => 'nullable|integer|min:0',
            'cost_center2_id' => 'nullable|integer|min:0',
            'credit_status' => 'nullable|exists:credit_status_setups,id',
            'payment_terms' => 'nullable|exists:payment_terms,terms_indicator',
            'discount' => 'nullable|numeric|min:0',
            'pymt_discount' => 'nullable|numeric|min:0',
            'credit_limit' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'inactive' => 'boolean',
        ];
    }

    protected function prepareForValidation(): void
    {
        // DB column `gst` is NOT NULL with default '' — Laravel converts "" to null.
        if ($this->input('gst') === null) {
            $this->merge(['gst' => '']);
        }
    }

    public function validated($key = null, $default = null)
    {
        $data = parent::validated($key, $default);

        if (! is_array($data)) {
            return $data;
        }

        if (array_key_exists('gst', $data) && $data['gst'] === null) {
            $data['gst'] = '';
        }

        return $data;
    }
}
