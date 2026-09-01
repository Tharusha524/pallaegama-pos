<?php

namespace App\Http\Controllers;

use App\Models\LoyaltyCard;
use Illuminate\Http\Request;
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
        ]);

        $card->update($data);
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
}
