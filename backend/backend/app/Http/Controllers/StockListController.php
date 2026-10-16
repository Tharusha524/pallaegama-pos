<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A read-only inventory list for the Smart Supermarket "Stock" screen —
 * searchable by name/stock_id/barcode, filterable by category. Purely a
 * reporting query over existing tables (stock_master, loc_stock,
 * item_category, item_codes) — no writes, so it cannot affect accounting.
 */
class StockListController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category_id');
        $brandId = $request->query('brand_id');
        $subcategoryId = $request->query('subcategory_id');

        $query = DB::table('stock_master as sm')
            ->leftJoin('item_category as ic', 'ic.category_id', '=', 'sm.category_id')
            ->leftJoin('subcategories as sub', 'sub.id', '=', 'sm.subcategory_id')
            ->leftJoin('brands as br', 'br.id', '=', 'sm.brand_id')
            ->leftJoin('item_units as iu', 'iu.id', '=', 'sm.units')
            ->leftJoin(DB::raw('(select stock_id, sum(quantity) as total_qty from loc_stock group by stock_id) as ls'), 'ls.stock_id', '=', 'sm.stock_id')
            ->leftJoin(DB::raw('(select stock_id, min(item_code) as barcode from item_codes group by stock_id) as codes'), 'codes.stock_id', '=', 'sm.stock_id')
            ->leftJoin('sales_pricing as sp', function ($join) {
                $join->on('sp.stock_id', '=', 'sm.stock_id')
                     ->where('sp.sales_type_id', '=', 3)
                     ->where('sp.currency_id', '=', 8);
            })
            ->where('sm.inactive', false)
            ->select(
                'sm.stock_id',
                'sm.description',
                'sm.category_id',
                'ic.description as category_name',
                'sm.subcategory_id',
                'sub.name as subcategory_name',
                'sm.brand_id',
                'br.name as brand_name',
                'sm.units',
                'iu.name as unit_name',
                'sm.mb_flag',
                'sm.purchase_cost',
                'sm.mrp_price',
                'sm.wholesale_qty_threshold',
                'sm.wholesale_price',
                'sm.eoq_ordering_cost',
                'sm.eoq_holding_cost_percent',
                'sm.expiry_date',
                'sp.price as selling_price',
                DB::raw('COALESCE(ls.total_qty, 0) as quantity'),
                'codes.barcode'
            );

        if ($categoryId) {
            $query->where('sm.category_id', $categoryId);
        }

        if ($brandId) {
            $query->where('sm.brand_id', $brandId);
        }

        if ($subcategoryId) {
            $query->where('sm.subcategory_id', $subcategoryId);
        }

        if ($search !== '') {
            $like = "%{$search}%";
            $query->where(function ($q) use ($like) {
                $q->where('sm.stock_id', 'like', $like)
                  ->orWhere('sm.description', 'like', $like)
                  ->orWhereExists(function ($sub) use ($like) {
                      $sub->select(DB::raw(1))
                          ->from('item_codes')
                          ->whereColumn('item_codes.stock_id', 'sm.stock_id')
                          ->where('item_codes.item_code', 'like', $like);
                  });
            });
        }

        return response()->json($query->orderBy('sm.description')->limit(5000)->get());
    }
}
