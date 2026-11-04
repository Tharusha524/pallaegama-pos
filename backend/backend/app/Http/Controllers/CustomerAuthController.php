<?php

namespace App\Http\Controllers;

use App\Models\CustomerBranch;
use App\Models\DebtorsMaster;
use App\Models\LoyaltyCard;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerAuthController extends Controller
{
    /**
     * Self-registration for a customer. Creates the debtors_master record
     * (the same table used everywhere else as "the customer" for accounting)
     * with a password, so the mobile app has an account to log into.
     *
     * A debtor is not usable for real sales/GL posting on its own — it needs
     * currency, sales type, credit status, payment terms and a branch with
     * GL accounts, exactly like the "Walk-in Customer" seeder sets up. We
     * mirror that same defaulting here instead of inventing new accounting
     * behavior, so self-registered customers post through the ledger the
     * same way a staff-created customer does.
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'mobile' => 'required|string|max:30|unique:debtors_master,mobile',
            'email' => 'nullable|email|max:255|unique:debtors_master,email',
            'date_of_birth' => 'nullable|date',
            'address' => 'nullable|string|max:255',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $currency = DB::table('currencies')->first();
        $salesType = DB::table('sales_types')->first();
        $creditStatus = DB::table('credit_status_setups')->where('disallow_invoices', 0)->first();
        $paymentTerm = DB::table('payment_terms')->where('description', 'like', '%cash%')->first()
            ?? DB::table('payment_terms')->first();
        $location = DB::table('inventory_locations')->first();

        if (! $currency || ! $salesType || ! $creditStatus || ! $paymentTerm || ! $location) {
            return response()->json([
                'message' => 'Store is not fully set up yet (missing currency/sales type/credit status/payment terms/location). Ask an admin to finish Company Setup before customers can register.',
            ], 422);
        }

        $customer = DB::transaction(function () use ($data, $currency, $salesType, $creditStatus, $paymentTerm, $location) {
            $customer = DebtorsMaster::create([
                'name' => $data['name'],
                'mobile' => $data['mobile'],
                'email' => $data['email'] ?? null,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'address' => $data['address'] ?? '',
                'password' => Hash::make($data['password']),
                'debtor_ref' => 'CUST-' . strtoupper(Str::random(6)),
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
                'notes' => 'Self-registered via mobile app.',
                'inactive' => false,
            ]);

            $salesAccount = DB::table('sys_prefs')->where('name', 'salesAccount')->value('value');
            $salesDiscountAccount = DB::table('sys_prefs')->where('name', 'salesDiscountAccount')->value('value');
            $receivableAccount = DB::table('sys_prefs')->where('name', 'receivableAccount')->value('value');
            $promptPaymentDiscountAccount = DB::table('sys_prefs')->where('name', 'promptPaymentDiscountAccount')->value('value');

            CustomerBranch::create([
                'debtor_no' => $customer->debtor_no,
                'br_name' => $data['name'],
                'branch_ref' => $customer->debtor_ref,
                'br_address' => $data['address'] ?? '',
                'inventory_location' => $location->loc_code,
                'sales_account' => $salesAccount,
                'sales_discount_account' => $salesDiscountAccount,
                'receivables_account' => $receivableAccount,
                'payment_discount_account' => $promptPaymentDiscountAccount,
                'inactive' => false,
            ]);

            // Everyone who joins through the app is a loyalty customer — the
            // same Silver card a customer added at the POS gets, so they show
            // on Loyalty Customers and the app has a card to display.
            LoyaltyCard::create([
                'debtor_no' => $customer->debtor_no,
                'card_no' => 'LC' . strtoupper(Str::random(8)),
                'issue_date' => now()->toDateString(),
                'loyalty_tier_id' => DB::table('loyalty_tiers')->orderBy('min_spend_threshold')->value('id'),
                'points_balance' => 0,
                'status' => 'active',
            ]);

            return $customer;
        });

        $token = $customer->createToken('customer-app', ['customer'])->plainTextToken;

        return response()->json([
            'customer' => $customer,
            'token' => $token,
        ], 201);
    }

    /**
     * Login by mobile number or email + password. Issues a Sanctum token
     * scoped with the "customer" ability so it can only be used on
     * customer-facing routes (see EnsureCustomerToken middleware).
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            'login' => 'required|string', // mobile or email
            'password' => 'required|string',
        ]);

        $customer = DebtorsMaster::query()
            ->where('mobile', $data['login'])
            ->orWhere('email', $data['login'])
            ->first();

        if (! $customer || ! $customer->password || ! Hash::check($data['password'], $customer->password)) {
            throw ValidationException::withMessages([
                'login' => ['Invalid credentials.'],
            ]);
        }

        if ($customer->inactive) {
            return response()->json(['message' => 'This account is inactive.'], 403);
        }

        $token = $customer->createToken('customer-app', ['customer'])->plainTextToken;

        return response()->json([
            'customer' => $customer,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Send a password reset link/code. Uses Laravel's password broker
     * configured for the "customers" provider (see config/auth.php).
     */
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $status = Password::broker('customers')->sendResetLink(
            $request->only('email')
        );

        return $status === Password::RESET_LINK_SENT
            ? response()->json(['message' => __($status)])
            : response()->json(['message' => __($status)], 422);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::broker('customers')->reset(
            $data,
            function (DebtorsMaster $customer, string $password) {
                $customer->forceFill(['password' => Hash::make($password)])->save();
                event(new PasswordReset($customer));
            }
        );

        return $status === Password::PASSWORD_RESET
            ? response()->json(['message' => __($status)])
            : response()->json(['message' => __($status)], 422);
    }
}
