<?php

namespace App\Http\Controllers;

use App\Models\WarrantyClaim;
use Illuminate\Http\Request;

class WarrantyClaimController extends Controller
{
    public function index()
    {
        return response()->json(WarrantyClaim::with('warranty.stock:stock_id,description')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'warranty_id' => 'required|exists:warranties,id',
            'issue_description' => 'required|string',
            'claim_date' => 'nullable|date',
        ]);

        $data['claim_date'] = $data['claim_date'] ?? now()->toDateString();
        $data['status'] = 'open';

        return response()->json(WarrantyClaim::create($data)->load('warranty.stock:stock_id,description'), 201);
    }

    public function update(Request $request, string $id)
    {
        $claim = WarrantyClaim::find($id);
        if (!$claim) {
            return response()->json(['message' => 'Claim not found'], 404);
        }

        $data = $request->validate([
            'status' => 'required|in:open,in_progress,resolved,rejected',
            'resolution_notes' => 'nullable|string',
        ]);

        $claim->update($data);
        return response()->json($claim);
    }
}
