<?php

namespace App\Http\Controllers;

use App\Models\WarrantyPolicy;
use Illuminate\Http\Request;

class WarrantyPolicyController extends Controller
{
    public function index()
    {
        return response()->json(WarrantyPolicy::orderBy('policy_name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'policy_name' => 'required|string|max:100',
            'period_value' => 'required|integer|min:1',
            'period_unit' => 'required|in:days,months,years',
            'terms' => 'nullable|string',
        ]);
        return response()->json(WarrantyPolicy::create($data), 201);
    }

    public function update(Request $request, string $id)
    {
        $policy = WarrantyPolicy::find($id);
        if (!$policy) {
            return response()->json(['message' => 'Policy not found'], 404);
        }
        $data = $request->validate([
            'policy_name' => 'sometimes|required|string|max:100',
            'period_value' => 'sometimes|required|integer|min:1',
            'period_unit' => 'sometimes|required|in:days,months,years',
            'terms' => 'nullable|string',
        ]);
        $policy->update($data);
        return response()->json($policy);
    }

    public function destroy(string $id)
    {
        $policy = WarrantyPolicy::find($id);
        if (!$policy) {
            return response()->json(['message' => 'Policy not found'], 404);
        }
        $policy->delete();
        return response()->json(['message' => 'Policy deleted']);
    }
}
