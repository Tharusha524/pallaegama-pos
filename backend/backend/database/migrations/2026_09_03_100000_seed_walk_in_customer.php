<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seeds a default "Walk-in Customer" so POS Checkout never has to force the
 * cashier to pick a real, named customer for a simple cash sale — exactly
 * how the reference POS system behaves. Selecting a real customer stays
 * available (and necessary) for loyalty points/credit sales.
 */
return new class extends Migration
{
    public function up(): void
    {
        $existing = DB::table('debtors_master')->where('name', 'Walk-in Customer')->first();
        if ($existing) {
            return;
        }

        $currency = DB::table('currencies')->first();
        $salesType = DB::table('sales_types')->first();
        $creditStatus = DB::table('credit_status_setups')->where('disallow_invoices', 0)->first();
        $paymentTerm = DB::table('payment_terms')->where('description', 'like', '%cash%')->first()
            ?? DB::table('payment_terms')->first();
        $location = DB::table('inventory_locations')->first();

        if (!$currency || !$salesType || !$creditStatus || !$paymentTerm || !$location) {
            // Base setup data not present yet (fresh install) — skip silently,
            // the walk-in customer can be created manually via the UI instead.
            return;
        }

        $debtorNo = DB::table('debtors_master')->insertGetId([
            'name' => 'Walk-in Customer',
            'debtor_ref' => 'WALKIN',
            'address' => '',
            'gst' => '',
            'curr_code' => $currency->currency_abbreviation,
            'sales_type' => $salesType->id,
            'cost_center_id' => 0,
            'cost_center2_id' => 0,
            'credit_status' => $creditStatus->id,
            'payment_terms' => $paymentTerm->terms_indicator,
            'discount' => 0,
            'pymt_discount' => 0,
            'credit_limit' => 0,
            'notes' => 'Default customer for walk-in / cash sales with no loyalty tracking.',
            'inactive' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $salesAccount = DB::table('sys_prefs')->where('name', 'salesAccount')->value('value');
        $salesDiscountAccount = DB::table('sys_prefs')->where('name', 'salesDiscountAccount')->value('value');
        $receivableAccount = DB::table('sys_prefs')->where('name', 'receivableAccount')->value('value');
        $promptPaymentDiscountAccount = DB::table('sys_prefs')->where('name', 'promptPaymentDiscountAccount')->value('value');

        DB::table('cust_branch')->insert([
            'debtor_no' => $debtorNo,
            'br_name' => 'Walk-in',
            'branch_ref' => 'WALKIN',
            'br_address' => '',
            'inventory_location' => $location->loc_code,
            'sales_account' => $salesAccount,
            'sales_discount_account' => $salesDiscountAccount,
            'receivables_account' => $receivableAccount,
            'payment_discount_account' => $promptPaymentDiscountAccount,
            'inactive' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        $debtor = DB::table('debtors_master')->where('name', 'Walk-in Customer')->first();
        if ($debtor) {
            DB::table('cust_branch')->where('debtor_no', $debtor->debtor_no)->delete();
            DB::table('debtors_master')->where('debtor_no', $debtor->debtor_no)->delete();
        }
    }
};
