<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseAnalyticsController extends Controller
{
    /**
     * For a given item: lowest purchase price ever paid and which supplier gave it
     * (proposal's "Lowest Purchase Price & Supplier" stock field).
     */
    public function lowestCostBySupplier(Request $request)
    {
        $stockId = $request->query('stock_id');

        $query = DB::table('supp_invoice_items as sii')
            ->join('supp_trans as st', function ($join) {
                $join->on('st.trans_no', '=', 'sii.supp_trans_no')
                     ->on('st.trans_type', '=', 'sii.supp_trans_type');
            })
            ->join('suppliers as s', 's.supplier_id', '=', 'st.supplier_id')
            ->select('sii.stock_id')
            ->selectRaw('MIN(sii.unit_price) as lowest_price')
            ->selectRaw('s.supp_name as supplier_name')
            ->groupBy('sii.stock_id', 's.supp_name');

        if ($stockId) {
            $query->where('sii.stock_id', $stockId);
        }

        return response()->json($query->get());
    }

    /**
     * Best supplier report: ranks suppliers by total purchase volume/value.
     */
    public function bestSuppliers(Request $request)
    {
        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');

        $query = DB::table('supp_trans as st')
            ->join('suppliers as s', 's.supplier_id', '=', 'st.supplier_id')
            ->select('s.supplier_id', 's.supp_name')
            ->selectRaw('COUNT(DISTINCT st.trans_no) as invoice_count')
            ->selectRaw('SUM(st.ov_amount) as total_purchase_value')
            ->groupBy('s.supplier_id', 's.supp_name')
            ->orderByDesc('total_purchase_value');

        if ($fromDate && $toDate) {
            $query->whereBetween('st.trans_date', [$fromDate, $toDate]);
        }

        return response()->json($query->get());
    }
}
