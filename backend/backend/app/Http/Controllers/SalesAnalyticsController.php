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
     * Products frequently bought in the same invoice as the given item.
     */
    public function frequentlyBoughtTogether(Request $request)
    {
        $stockId = $request->query('stock_id');
        if (!$stockId) {
            return response()->json(['message' => 'stock_id is required'], 422);
        }

        $rows = DB::table('debtor_trans_details as a')
            ->join('debtor_trans_details as b', function ($join) {
                $join->on('a.debtor_trans_no', '=', 'b.debtor_trans_no')
                     ->on('a.debtor_trans_type', '=', 'b.debtor_trans_type')
                     ->where('a.stock_id', '!=', DB::raw('b.stock_id'));
            })
            ->join('stock_master as sm', 'sm.stock_id', '=', 'b.stock_id')
            ->where('a.stock_id', $stockId)
            ->select('b.stock_id', 'sm.description')
            ->selectRaw('COUNT(*) as times_bought_together')
            ->groupBy('b.stock_id', 'sm.description')
            ->orderByDesc('times_bought_together')
            ->limit(10)
            ->get();

        return response()->json($rows);
    }

    /**
     * RFM-style customer segmentation: Recency (days since last purchase),
     * Frequency (invoice count), Monetary (total spend), each scored 1-5,
     * then bucketed into a plain-English segment.
     */
    public function customerSegments(Request $request)
    {
        $lookbackDays = (int) $request->query('lookback_days', 365);
        $since = now()->subDays($lookbackDays)->toDateString();
        $today = now();

        $rows = DB::table('debtor_trans as dt')
            ->join('debtors_master as dm', 'dm.debtor_no', '=', 'dt.debtor_no')
            ->where('dt.trans_type', 10)
            ->where('dt.tran_date', '>=', $since)
            ->select('dm.debtor_no', 'dm.name', 'dm.last_purchase_date')
            ->selectRaw('COUNT(*) as frequency')
            ->selectRaw('SUM(dt.ov_amount) as monetary')
            ->selectRaw('MAX(dt.tran_date) as last_purchase')
            ->groupBy('dm.debtor_no', 'dm.name', 'dm.last_purchase_date')
            ->get();

        if ($rows->isEmpty()) {
            return response()->json([]);
        }

        $frequencies = $rows->pluck('frequency')->sort()->values();
        $monetaries = $rows->pluck('monetary')->sort()->values();

        $scoreFromRank = function ($value, $sorted) {
            $count = $sorted->count();
            if ($count === 0) return 3;
            $rank = $sorted->search(fn($v) => $v >= $value);
            $rank = $rank === false ? $count - 1 : $rank;
            return min(5, max(1, (int) ceil((($rank + 1) / $count) * 5)));
        };

        $result = $rows->map(function ($row) use ($today, $frequencies, $monetaries, $scoreFromRank) {
            $recencyDays = $row->last_purchase ? (int) abs($today->diffInDays($row->last_purchase)) : 9999;
            $recencyScore = $recencyDays <= 7 ? 5 : ($recencyDays <= 30 ? 4 : ($recencyDays <= 90 ? 3 : ($recencyDays <= 180 ? 2 : 1)));
            $frequencyScore = $scoreFromRank($row->frequency, $frequencies);
            $monetaryScore = $scoreFromRank($row->monetary, $monetaries);

            $avg = ($recencyScore + $frequencyScore + $monetaryScore) / 3;
            $segment = match (true) {
                $recencyScore >= 4 && $frequencyScore >= 4 && $monetaryScore >= 4 => 'Champion',
                $recencyScore >= 3 && $avg >= 3.5 => 'Loyal Customer',
                $recencyScore <= 2 && $frequencyScore >= 3 => 'At Risk',
                $recencyScore <= 2 && $frequencyScore <= 2 => 'Dormant',
                $frequencyScore <= 1 => 'One-Time Buyer',
                default => 'Potential Loyalist',
            };

            return [
                'debtor_no' => $row->debtor_no,
                'name' => $row->name,
                'recency_days' => $recencyDays,
                'frequency' => $row->frequency,
                'monetary' => (float) $row->monetary,
                'segment' => $segment,
            ];
        });

        return response()->json($result->sortBy('recency_days')->values());
    }

    /**
     * Velocity & demand: units sold per day, ranked fast/slow moving.
     */
    public function velocityAndDemand(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());
        $days = max(1, now()->parse($fromDate)->diffInDays(now()->parse($toDate)));

        $rows = DB::table('debtor_trans_details as dtd')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'dtd.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'dtd.debtor_trans_type');
            })
            ->join('stock_master as sm', 'sm.stock_id', '=', 'dtd.stock_id')
            ->whereBetween('dt.tran_date', [$fromDate, $toDate])
            ->select('dtd.stock_id', 'sm.description')
            ->selectRaw('SUM(dtd.quantity) as units_sold')
            ->selectRaw('SUM(dtd.quantity * dtd.unit_price) as revenue')
            ->groupBy('dtd.stock_id', 'sm.description')
            ->get()
            ->map(function ($r) use ($days) {
                $r->avg_per_day = round($r->units_sold / $days, 2);
                return $r;
            });

        return response()->json([
            'fast_moving' => $rows->sortByDesc('avg_per_day')->take(20)->values(),
            'slow_moving' => $rows->sortBy('avg_per_day')->take(20)->values(),
        ]);
    }

    /**
     * Dead stock: items with on-hand quantity but zero sales in the period.
     */
    public function deadStock(Request $request)
    {
        $days = (int) $request->query('lookback_days', 90);
        $since = now()->subDays($days)->toDateString();

        $soldStockIds = DB::table('debtor_trans_details as dtd')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'dtd.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'dtd.debtor_trans_type');
            })
            ->where('dt.tran_date', '>=', $since)
            ->distinct()
            ->pluck('dtd.stock_id');

        $rows = DB::table('loc_stock as ls')
            ->join('stock_master as sm', 'sm.stock_id', '=', 'ls.stock_id')
            ->where('ls.quantity', '>', 0)
            ->whereNotIn('ls.stock_id', $soldStockIds)
            ->when($request->filled('loc_code'), fn ($q) => $q->where('ls.loc_code', $request->query('loc_code')))
            ->select('ls.stock_id', 'sm.description', 'ls.loc_code', 'ls.quantity')
            ->get();

        return response()->json($rows);
    }

    /**
     * Per-product profit margin over a date range.
     */
    public function productProfit(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());

        $rows = DB::table('debtor_trans_details as dtd')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'dtd.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'dtd.debtor_trans_type');
            })
            ->join('stock_master as sm', 'sm.stock_id', '=', 'dtd.stock_id')
            ->whereBetween('dt.tran_date', [$fromDate, $toDate])
            ->select('dtd.stock_id', 'sm.description')
            ->selectRaw('SUM(dtd.quantity) as units_sold')
            ->selectRaw('SUM(dtd.quantity * dtd.unit_price) as revenue')
            ->selectRaw('SUM(dtd.quantity * dtd.standard_cost) as cost')
            ->groupBy('dtd.stock_id', 'sm.description')
            ->get()
            ->map(function ($r) {
                $r->gross_profit = $r->revenue - $r->cost;
                $r->margin_percent = $r->revenue > 0 ? round(($r->gross_profit / $r->revenue) * 100, 1) : 0;
                return $r;
            });

        return response()->json($rows->sortByDesc('gross_profit')->values());
    }

    /**
     * Unified activity feed: sales, refunds, expenses, offline entries,
     * vouchers, warranty claims — everything in one chronological list.
     */
    public function businessActivityFeed(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());

        $sales = DB::table('debtor_trans as dt')
            ->join('debtors_master as dm', 'dm.debtor_no', '=', 'dt.debtor_no')
            ->whereIn('dt.trans_type', [10, 11])
            ->whereBetween('dt.tran_date', [$fromDate, $toDate])
            ->select('dt.tran_date as date', DB::raw("IF(dt.trans_type = 11, 'refund', 'sale') as type"), 'dt.reference as ref', 'dm.name as party', 'dt.ov_amount as amount');

        $offline = DB::table('offline_entries')
            ->whereBetween('entry_date', [$fromDate, $toDate])
            ->select('entry_date as date', DB::raw("CONCAT('offline_', entry_type) as type"), DB::raw("'—' as ref"), DB::raw('CAST(debtor_no AS CHAR) as party'), 'total_amount as amount');

        $vouchers = DB::table('vouchers')
            ->whereBetween('issue_date', [$fromDate, $toDate])
            ->select('issue_date as date', DB::raw("'voucher_issued' as type"), 'voucher_code as ref', DB::raw("'—' as party"), 'face_value as amount');

        $rows = $sales->unionAll($offline)->unionAll($vouchers)
            ->orderByDesc('date')
            ->limit(200)
            ->get();

        return response()->json($rows);
    }

    /**
     * Inventory valuation: on-hand quantity x cost, per item and total.
     */
    public function valuation(Request $request)
    {
        $rows = DB::table('loc_stock as ls')
            ->join('stock_master as sm', 'sm.stock_id', '=', 'ls.stock_id')
            ->where('ls.quantity', '>', 0)
            ->when($request->filled('loc_code'), fn ($q) => $q->where('ls.loc_code', $request->query('loc_code')))
            ->select('ls.stock_id', 'sm.description', 'ls.loc_code', 'ls.quantity', 'sm.purchase_cost')
            ->get()
            ->map(function ($r) {
                $r->value = $r->quantity * $r->purchase_cost;
                return $r;
            });

        return response()->json([
            'items' => $rows,
            'total_value' => $rows->sum('value'),
        ]);
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
