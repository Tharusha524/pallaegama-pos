<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SupplierRequest extends FormRequest
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
            'supp_name' => 'required|string|max:60',
            'supp_short_name' => 'required|string|max:30',
            'gst_no' => 'nullable|string|max:25',
            'website' => 'nullable|string|max:100',
            'curr_code' => 'nullable|exists:currencies,currency_abbreviation',
            'tax_group' => 'nullable|exists:tax_groups,id',
            'supp_account_no' => 'nullable|string|max:40',
            'bank_account' => 'nullable|string|max:60',
            'credit_limit' => 'nullable|numeric|min:0',
            'payment_terms' => 'nullable|exists:payment_terms,terms_indicator',
            'tax_included' => 'boolean',
            'payable_account' => 'nullable|exists:chart_master,account_code',
            'purchase_account' => 'nullable|exists:chart_master,account_code',
            'payment_discount_account' => 'nullable|exists:chart_master,account_code',
            'contact' => 'nullable|string|max:60',
            'cost_center_id' => 'nullable|integer|min:0',
            'cost_center2_id' => 'nullable|integer|min:0',
            'mail_address' => 'nullable|string',
            'bill_address' => 'nullable|string',
            'notes' => 'nullable|string',
            'inactive' => 'boolean',
        ];
    }

    protected function prepareForValidation(): void
    {
        $toEmpty = [
            'gst_no',
            'website',
            'supp_account_no',
            'bank_account',
            'contact',
            'mail_address',
            'bill_address',
            'notes',
        ];

        $toNull = [
            'tax_group',
            'payment_terms',
            'payable_account',
            'purchase_account',
            'payment_discount_account',
            'curr_code',
        ];

        $merged = [];

        foreach ($toEmpty as $field) {
            // Default to '' whenever the field is missing entirely, not just
            // when it's present-but-empty — these columns have no DB default,
            // so a client that omits them (e.g. a minimal quick-create form)
            // must still get a valid empty string, not have the key vanish.
            if (! $this->has($field) || $this->input($field) === null || $this->input($field) === '') {
                $merged[$field] = '';
            }
        }

        foreach ($toNull as $field) {
            if ($this->has($field) && ($this->input($field) === null || $this->input($field) === '')) {
                $merged[$field] = null;
            }
        }

        if ($this->has('credit_limit') && ($this->input('credit_limit') === null || $this->input('credit_limit') === '')) {
            $merged['credit_limit'] = 0;
        }

        foreach (['cost_center_id', 'cost_center2_id'] as $field) {
            if ($this->has($field) && ($this->input($field) === null || $this->input($field) === '')) {
                $merged[$field] = 0;
            }
        }

        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    public function validated($key = null, $default = null)
    {
        $data = parent::validated($key, $default);

        if (! is_array($data)) {
            return $data;
        }

        foreach (['gst_no', 'website', 'supp_account_no', 'bank_account', 'contact', 'mail_address', 'bill_address', 'notes'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] === null) {
                $data[$field] = '';
            }
        }

        foreach (['cost_center_id', 'cost_center2_id'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] === null) {
                $data[$field] = 0;
            }
        }

        return $data;
    }
}
