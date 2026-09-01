<?php

namespace App\Http\Controllers;

use App\Models\ItemCode;
use App\Models\StockMaster;
use Illuminate\Http\Request;

class BarcodeLookupController extends Controller
{
    /**
     * Resolve a scanned/typed barcode to a stock item.
     * Checks item_codes.item_code (barcode/foreign code) first, then
     * falls back to stock_master.stock_id for items scanned/entered
     * by their own item code.
     */
    public function lookup(Request $request)
    {
        $code = trim((string) $request->query('code', ''));
        if ($code === '') {
            return response()->json(['message' => 'No code provided'], 422);
        }

        $itemCode = ItemCode::where('item_code', $code)->where('inactive', false)->first();
        if ($itemCode) {
            $stock = StockMaster::where('stock_id', $itemCode->stock_id)->where('inactive', false)->first();
            if ($stock) {
                return response()->json($stock);
            }
        }

        $stock = StockMaster::where('stock_id', $code)->where('inactive', false)->first();
        if ($stock) {
            return response()->json($stock);
        }

        return response()->json(['message' => "No product found for code \"{$code}\""], 404);
    }
}
