<?php

namespace App\Http\Controllers;

use App\Models\StockDamage;
use App\Models\LocStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockDamageController extends Controller
{
    public function index(Request $request)
    {
        $query = StockDamage::with('stock:stock_id,description')->orderByDesc('damage_date');

        if ($request->filled('stock_id')) {
            $query->where('stock_id', $request->query('stock_id'));
        }
        if ($request->filled('from_date') && $request->filled('to_date')) {
            $query->whereBetween('damage_date', [$request->query('from_date'), $request->query('to_date')]);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'stock_id' => 'required|exists:stock_master,stock_id',
            'loc_code' => 'nullable|string|max:20',
            'quantity' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string|max:255',
            'damage_date' => 'nullable|date',
        ]);

        $data['damage_date'] = $data['damage_date'] ?? now()->toDateString();
        $data['recorded_by'] = $request->user()->id ?? null;

        return DB::transaction(function () use ($data) {
            $damage = StockDamage::create($data);

            // Deduct damaged quantity from location stock, if that location row exists.
            if (!empty($data['loc_code'])) {
                LocStock::where('stock_id', $data['stock_id'])
                    ->where('loc_code', $data['loc_code'])
                    ->decrement('quantity', $data['quantity']);
            }

            return response()->json($damage, 201);
        });
    }

    public function destroy(string $id)
    {
        $damage = StockDamage::find($id);
        if (!$damage) {
            return response()->json(['message' => 'Damage record not found'], 404);
        }
        $damage->delete();
        return response()->json(['message' => 'Damage record deleted']);
    }

    /**
     * Summary: total damaged quantity per item over a period (proposal's
     * "Quantity Damaged During Last Month" field).
     */
    public function summary(Request $request)
    {
        $query = StockDamage::select('stock_id')
            ->selectRaw('SUM(quantity) as total_damaged')
            ->with('stock:stock_id,description')
            ->groupBy('stock_id');

        if ($request->filled('from_date') && $request->filled('to_date')) {
            $query->whereBetween('damage_date', [$request->query('from_date'), $request->query('to_date')]);
        }

        return response()->json($query->get());
    }
}
