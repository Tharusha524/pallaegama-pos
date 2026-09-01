<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesAnalyticsController extends Controller
{
    /**
     * Dashboard KPIs: today's sales, bills issued today, debtor/creditor totals.
     */
    public function dashboardSummary()
    {
        $today = now()->toDateString();

        $todaySales = DB::table('debtor_trans')
            ->whereDate('tran_date', $today)
            ->where('trans_type', 10) // customer invoice trans type (FrontAccounting convention)
            ->sum('ov_amount');

        $billsToday = DB::table('debtor_trans')
            ->whereDate('tran_date', $today)
            ->where('trans_type', 10)
            ->count();

        $totalDebtors = DB::table('debtor_trans')
            ->where('trans_type', 10)
            ->selectRaw('SUM(ov_amount - alloc) as total')
            ->value('total');

        $totalCreditors = DB::table('supp_trans')
            ->selectRaw('SUM(ov_amount - alloc) as total')
            ->value('total');

        $lowStockCount = DB::table('loc_stock')
            ->whereNotNull('reorder_level')
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->count();

        return response()->json([
            'today_sales' => (float) $todaySales,
            'bills_issued_today' => (int) $billsToday,
            'total_debtors_outstanding' => (float) $totalDebtors,
            'total_creditors_payable' => (float) $totalCreditors,
            'low_stock_count' => $lowStockCount,
        ]);
    }

    /**
     * Best and slow selling products over a date range.
     */
    public function productPerformance(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());
        $limit = (int) $request->query('limit', 20);

        $base = DB::table('debtor_trans_details as dtd')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'dtd.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'dtd.debtor_trans_type');
            })
            ->join('stock_master as sm', 'sm.stock_id', '=', 'dtd.stock_id')
            ->whereBetween('dt.tran_date', [$fromDate, $toDate])
            ->select('dtd.stock_id', 'sm.description')
            ->selectRaw('SUM(dtd.quantity) as qty_sold')
            ->selectRaw('SUM(dtd.quantity * dtd.unit_price) as revenue')
            ->groupBy('dtd.stock_id', 'sm.description');

        $bestSelling = (clone $base)->orderByDesc('qty_sold')->limit($limit)->get();
        $slowSelling = (clone $base)->orderBy('qty_sold')->limit($limit)->get();

        return response()->json([
            'best_selling' => $bestSelling,
            'slow_selling' => $slowSelling,
        ]);
    }

    /**
     * Sales trend by day or month.
     */
    public function salesTrend(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());
        $groupBy = $request->query('group_by', 'day'); // day | month

        $dateFormat = $groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

        $rows = DB::table('debtor_trans')
            ->whereBetween('tran_date', [$fromDate, $toDate])
            ->selectRaw("DATE_FORMAT(tran_date, '{$dateFormat}') as period")
            ->selectRaw('SUM(ov_amount) as total_sales')
            ->selectRaw('COUNT(*) as bill_count')
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        return response()->json($rows);
    }

    /**
     * Top customers by total spend.
     */
    public function topCustomers(Request $request)
    {
        $limit = (int) $request->query('limit', 10);

        $rows = DB::table('debtor_trans as dt')
            ->join('debtors_master as dm', 'dm.debtor_no', '=', 'dt.debtor_no')
            ->select('dm.debtor_no', 'dm.name')
            ->selectRaw('SUM(dt.ov_amount) as total_spend')
            ->selectRaw('COUNT(*) as invoice_count')
            ->groupBy('dm.debtor_no', 'dm.name')
            ->orderByDesc('total_spend')
            ->limit($limit)
            ->get();

        return response()->json($rows);
    }
}
