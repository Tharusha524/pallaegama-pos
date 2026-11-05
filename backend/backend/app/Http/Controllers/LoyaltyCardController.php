<?php

namespace App\Http\Controllers;

use App\Models\DebtorsMaster;
use App\Models\LoyaltyCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LoyaltyCardController extends Controller
{
    public function index()
    {
        return response()->json(LoyaltyCard::with(['debtor', 'tier'])->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'debtor_no' => 'required|exists:debtors_master,debtor_no|unique:loyalty_cards,debtor_no',
            'card_no' => 'nullable|string|max:50|unique:loyalty_cards,card_no',
            'issue_date' => 'nullable|date',
            'loyalty_tier_id' => 'nullable|exists:loyalty_tiers,id',
            'status' => 'in:active,blocked',
        ]);

        $data['card_no'] = $data['card_no'] ?? ('LC' . strtoupper(Str::random(8)));
        $data['issue_date'] = $data['issue_date'] ?? now()->toDateString();
        $data['points_balance'] = 0;

        $card = LoyaltyCard::create($data);
        return response()->json($card->load(['debtor', 'tier']), 201);
    }

    public function show(string $id)
    {
        $card = LoyaltyCard::with(['debtor', 'tier'])->find($id);
        if (!$card) {
            return response()->json(['message' => 'Loyalty card not found'], 404);
        }
        return response()->json($card);
    }

    public function update(Request $request, string $id)
    {
        $card = LoyaltyCard::find($id);
        if (!$card) {
            return response()->json(['message' => 'Loyalty card not found'], 404);
        }

        $data = $request->validate([
            'loyalty_tier_id' => 'nullable|exists:loyalty_tiers,id',
            'status' => 'in:active,blocked',
            // The customer's own details, edited from Loyalty Customers.
            'name' => 'sometimes|required|string|max:255',
            'mobile' => 'sometimes|nullable|string|max:30|unique:debtors_master,mobile,' . $card->debtor_no . ',debtor_no',
        ]);

        DB::transaction(function () use ($card, $data) {
            $card->update(collect($data)->only(['loyalty_tier_id', 'status'])->all());

            $customer = collect($data)->only(['name', 'mobile'])->all();
            if ($customer) {
                DebtorsMaster::where('debtor_no', $card->debtor_no)->update($customer);
            }
        });

        return response()->json($card->load(['debtor', 'tier']));
    }

    public function destroy(string $id)
    {
        $card = LoyaltyCard::find($id);
        if (!$card) {
            return response()->json(['message' => 'Loyalty card not found'], 404);
        }
        $card->delete();
        return response()->json(['message' => 'Loyalty card deleted']);
    }

    // Lookup loyalty account by customer phone number
    public function findByPhone(string $phone)
    {
        $debtor = DebtorsMaster::where('mobile', $phone)->first();
        if (!$debtor) {
            return response()->json(['message' => 'No customer found with this phone number'], 404);
        }
        $card = LoyaltyCard::with(['debtor', 'tier'])->where('debtor_no', $debtor->debtor_no)->first();
        if (!$card) {
            return response()->json(['message' => 'Customer found but no loyalty account', 'debtor' => $debtor], 404);
        }
        return response()->json($card);
    }

    // Register a new loyalty customer by phone number (creates debtor + loyalty account)
    /**
     * Customers who signed up in the mobile app but have no loyalty card yet.
     */
    public function normalCustomers()
    {
        $rows = DB::table('debtors_master as d')
            ->whereNotNull('d.password')
            ->whereNotExists(fn ($q) => $q->from('loyalty_cards as c')->whereColumn('c.debtor_no', 'd.debtor_no'))
            ->select('d.debtor_no', 'd.name', 'd.mobile', 'd.email', 'd.date_of_birth', 'd.created_at')
            ->orderByDesc('d.created_at')
            ->get();

        return response()->json($rows);
    }

    /**
     * Turn a normal (app) customer into a loyalty customer: a new card on the
     * lowest tier (Silver). Tier upgrades count spending from today only.
     */
    public function makeLoyalty(string $debtorNo)
    {
        return DB::transaction(function () use ($debtorNo) {
            $debtor = DebtorsMaster::where('debtor_no', $debtorNo)->lockForUpdate()->first();
            if (! $debtor) {
                return response()->json(['message' => 'Customer not found.'], 404);
            }
            if (LoyaltyCard::where('debtor_no', $debtorNo)->exists()) {
                return response()->json(['message' => 'This customer is already a loyalty customer.'], 422);
            }

            $card = LoyaltyCard::create([
                'debtor_no'       => $debtorNo,
                'card_no'         => 'LC' . strtoupper(Str::random(8)),
                'issue_date'      => now()->toDateString(),
                'loyalty_tier_id' => DB::table('loyalty_tiers')->where('inactive', 0)->orderBy('min_spend_threshold')->value('id'),
                'points_balance'  => 0,
                'status'          => 'active',
            ]);

            return response()->json($card->load(['debtor', 'tier']), 201);
        });
    }

    public function registerByPhone(Request $request)
    {
        $data = $request->validate([
            'name'             => 'required|string|max:100',
            'mobile'           => 'required|string|max:20|unique:debtors_master,mobile',
            'loyalty_tier_id'  => 'nullable|exists:loyalty_tiers,id',
        ]);

        // Create a minimal debtor record
        $debtorNo = 'LC' . strtoupper(Str::random(6));
        while (DebtorsMaster::where('debtor_no', $debtorNo)->exists()) {
            $debtorNo = 'LC' . strtoupper(Str::random(6));
        }

        $debtor = DebtorsMaster::create([
            'debtor_no'      => $debtorNo,
            'name'           => $data['name'],
            'mobile'         => $data['mobile'],
            'curr_code'      => DB::table('currencies')->value('currency_code') ?? 'LKR',
            'sales_type'     => DB::table('sales_types')->value('id') ?? 3,
            'credit_status'  => 'OK',
            'payment_terms'  => DB::table('payment_terms')->value('terms_indicator') ?? 'cash',
            'discount'       => 0,
            'pymt_discount'  => 0,
            'credit_limit'   => 0,
            'inactive'       => false,
        ]);

        $card = LoyaltyCard::create([
            'debtor_no'       => $debtor->debtor_no,
            'card_no'         => 'LC' . strtoupper(Str::random(8)),
            'issue_date'      => now()->toDateString(),
            'loyalty_tier_id' => $data['loyalty_tier_id'] ?? null,
            'points_balance'  => 0,
            'status'          => 'active',
        ]);

        return response()->json($card->load(['debtor', 'tier']), 201);
    }
}
