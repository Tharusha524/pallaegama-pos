<?php

namespace App\Http\Controllers;

use App\Models\ItemCode;
use App\Models\ItemVariant;
use App\Models\StockMaster;
use Illuminate\Http\Request;

class BarcodeLookupController extends Controller
{
    /**
     * Resolve a scanned/typed barcode to a stock item.
     * Checks for a weighed-item sticker first (WT|<stock_id>|<price> — printed
     * at weigh-time for loose produce, price is frozen at the scale), then
     * item_variants.barcode (a specific size/color/weight variant), then
     * item_codes.item_code (barcode/foreign code), then falls back to
     * stock_master.stock_id for items scanned/entered by their own item code.
     */
    public function lookup(Request $request)
    {
        $code = trim((string) $request->query('code', ''));
        if ($code === '') {
            return response()->json(['message' => 'No code provided'], 422);
        }

        if (str_starts_with($code, 'WT|')) {
            $parts = explode('|', $code);
            if (count($parts) === 3) {
                [, $stockId, $priceStr] = $parts;
                $stock = StockMaster::where('stock_id', $stockId)->where('inactive', false)->first();
                if ($stock) {
                    $stockArray = $stock->toArray();
                    $stockArray['purchase_cost'] = (float) $priceStr;
                    $stockArray['is_weighted'] = true;
                    return response()->json($stockArray);
                }
            }
            return response()->json(['message' => "Weighed-item sticker refers to an unknown product"], 404);
        }

        $variant = ItemVariant::where('barcode', $code)->where('inactive', false)->first();
        if ($variant) {
            $stock = StockMaster::where('stock_id', $variant->stock_id)->where('inactive', false)->first();
            if ($stock) {
                $stockArray = $stock->toArray();
                $stockArray['matched_variant'] = $variant->only(['id', 'variant_name', 'price_adjustment']);
                $stockArray['purchase_cost'] = (float) ($stockArray['purchase_cost'] ?? 0) + (float) $variant->price_adjustment;
                return response()->json($stockArray);
            }
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
