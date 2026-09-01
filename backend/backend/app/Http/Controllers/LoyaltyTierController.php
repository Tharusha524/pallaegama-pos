<?php

namespace App\Http\Controllers;

use App\Models\LoyaltyTier;
use Illuminate\Http\Request;

class LoyaltyTierController extends Controller
{
    public function index()
    {
        return response()->json(LoyaltyTier::orderBy('min_spend_threshold')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'tier_name' => 'required|string|max:100',
            'min_spend_threshold' => 'nullable|numeric|min:0',
            'points_earn_rate' => 'nullable|numeric|min:0',
            'redemption_rate' => 'nullable|numeric|min:0',
            'benefits_description' => 'nullable|string',
            'inactive' => 'boolean',
        ]);

        return response()->json(LoyaltyTier::create($data), 201);
    }

    public function show(string $id)
    {
        $tier = LoyaltyTier::find($id);
        if (!$tier) {
            return response()->json(['message' => 'Loyalty tier not found'], 404);
        }
        return response()->json($tier);
    }

    public function update(Request $request, string $id)
    {
        $tier = LoyaltyTier::find($id);
        if (!$tier) {
            return response()->json(['message' => 'Loyalty tier not found'], 404);
        }

        $data = $request->validate([
            'tier_name' => 'sometimes|required|string|max:100',
            'min_spend_threshold' => 'nullable|numeric|min:0',
            'points_earn_rate' => 'nullable|numeric|min:0',
            'redemption_rate' => 'nullable|numeric|min:0',
            'benefits_description' => 'nullable|string',
            'inactive' => 'boolean',
        ]);

        $tier->update($data);
        return response()->json($tier);
    }

    public function destroy(string $id)
    {
        $tier = LoyaltyTier::find($id);
        if (!$tier) {
            return response()->json(['message' => 'Loyalty tier not found'], 404);
        }
        $tier->delete();
        return response()->json(['message' => 'Loyalty tier deleted']);
    }
}
