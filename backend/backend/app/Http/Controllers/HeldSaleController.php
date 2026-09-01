<?php

namespace App\Http\Controllers;

use App\Models\HeldSale;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HeldSaleController extends Controller
{
    public function index(Request $request)
    {
        $query = HeldSale::orderByDesc('id');
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->query('user_id'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|integer',
            'debtor_no' => 'nullable|integer|exists:debtors_master,debtor_no',
            'cart_snapshot' => 'required|array',
        ]);

        $data['hold_reference'] = 'HOLD-' . strtoupper(Str::random(8));

        return response()->json(HeldSale::create($data), 201);
    }

    public function show(string $id)
    {
        $held = HeldSale::find($id);
        if (!$held) {
            return response()->json(['message' => 'Held sale not found'], 404);
        }
        return response()->json($held);
    }

    public function destroy(string $id)
    {
        $held = HeldSale::find($id);
        if (!$held) {
            return response()->json(['message' => 'Held sale not found'], 404);
        }
        $held->delete();
        return response()->json(['message' => 'Held sale removed']);
    }
}
