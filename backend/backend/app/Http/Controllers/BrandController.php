<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use Illuminate\Http\Request;

/**
 * Product-organization data — a Brand belongs to a Category (e.g. Category
 * "Cosmetics" -> Brand "Unilever"), continuing the chain into Subcategory
 * below it. Pure label; no GL accounts, no accounting logic reads these.
 */
class BrandController extends Controller
{
    public function index()
    {
        return response()->json(Brand::with('category')->where('inactive', false)->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'category_id' => 'nullable|integer|exists:item_category,category_id',
        ]);

        return response()->json(Brand::create($data)->load('category'), 201);
    }

    public function update(Request $request, Brand $brand)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'category_id' => 'nullable|integer|exists:item_category,category_id',
        ]);

        $brand->update($data);

        return response()->json($brand->load('category'));
    }

    public function destroy(Brand $brand)
    {
        $brand->delete();

        return response()->json(['message' => 'Deleted successfully']);
    }
}
