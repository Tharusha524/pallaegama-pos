<?php

namespace App\Http\Controllers;

use App\Models\Subcategory;
use Illuminate\Http\Request;

/**
 * Product-organization data — a Subcategory belongs to a Category (e.g.
 * Cosmetics -> "Rani Shampoo 250g"). Brand is a separate, flat list that a
 * product carries on its own; the GL account mapping comes from the Category.
 */
class SubcategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = Subcategory::with(['brand', 'category'])->where('inactive', false)->orderBy('name');

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->query('category_id'));
        }
        if ($request->filled('brand_id')) {
            $query->where('brand_id', $request->query('brand_id'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_id' => 'required|integer|exists:item_category,category_id',
            'name' => 'required|string|max:100',
        ]);

        return response()->json(Subcategory::create($data)->load('category'), 201);
    }

    public function update(Request $request, Subcategory $subcategory)
    {
        $data = $request->validate([
            'category_id' => 'required|integer|exists:item_category,category_id',
            'name' => 'required|string|max:100',
        ]);

        $subcategory->update($data);

        return response()->json($subcategory->load('category'));
    }

    public function destroy(Subcategory $subcategory)
    {
        $subcategory->delete();

        return response()->json(['message' => 'Deleted successfully']);
    }
}
