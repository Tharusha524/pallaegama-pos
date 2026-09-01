<?php

namespace App\Http\Controllers;

use App\Models\ItemVariant;
use App\Models\VariantStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ItemVariantController extends Controller
{
    public function index(Request $request)
    {
        $query = ItemVariant::with('stock:stock_id,description')->orderByDesc('id');
        if ($request->filled('stock_id')) {
            $query->where('stock_id', $request->query('stock_id'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'stock_id' => 'required|exists:stock_master,stock_id',
            'variant_name' => 'required|string|max:150',
            'sku' => 'nullable|string|max:60',
            'barcode' => 'nullable|string|max:60|unique:item_variants,barcode',
            'price_adjustment' => 'nullable|numeric',
        ]);

        return response()->json(ItemVariant::create($data)->load('stock:stock_id,description'), 201);
    }

    public function update(Request $request, string $id)
    {
        $variant = ItemVariant::find($id);
        if (!$variant) {
            return response()->json(['message' => 'Variant not found'], 404);
        }

        $data = $request->validate([
            'variant_name' => 'sometimes|required|string|max:150',
            'sku' => 'nullable|string|max:60',
            'barcode' => 'nullable|string|max:60|unique:item_variants,barcode,' . $id,
            'price_adjustment' => 'nullable|numeric',
            'inactive' => 'boolean',
        ]);

        $variant->update($data);
        return response()->json($variant);
    }

    public function destroy(string $id)
    {
        $variant = ItemVariant::find($id);
        if (!$variant) {
            return response()->json(['message' => 'Variant not found'], 404);
        }
        $variant->delete();
        return response()->json(['message' => 'Variant deleted']);
    }

    /**
     * Set/adjust a variant's stock at a location.
     */
    public function setStock(Request $request, string $id)
    {
        $data = $request->validate([
            'loc_code' => 'required|exists:inventory_locations,loc_code',
            'quantity' => 'required|numeric|min:0',
        ]);

        $row = VariantStock::updateOrCreate(
            ['item_variant_id' => $id, 'loc_code' => $data['loc_code']],
            ['quantity' => $data['quantity']]
        );

        return response()->json($row);
    }

    /**
     * Deduct a variant's stock after a POS sale. This is a supplementary,
     * best-effort tracking layer — the base product's real stock (the one
     * that matters for accounting/GL) is already decremented by the normal
     * invoice/delivery flow against stock_master's stock_id; variant_stock
     * exists only so a size/color breakdown can be tracked alongside it.
     */
    public function deductStock(Request $request, string $id)
    {
        $data = $request->validate([
            'loc_code' => 'required|exists:inventory_locations,loc_code',
            'quantity' => 'required|numeric|min:0.01',
        ]);

        $row = VariantStock::firstOrCreate(
            ['item_variant_id' => $id, 'loc_code' => $data['loc_code']],
            ['quantity' => 0]
        );
        $row->quantity = max(0, $row->quantity - $data['quantity']);
        $row->save();

        return response()->json($row);
    }
}
