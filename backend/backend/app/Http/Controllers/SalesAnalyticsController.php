<?php

namespace App\Http\Controllers;

use App\Models\Offer;
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
            // Invoices only — each sale's delivery note repeats the same lines.
            ->where('dt.trans_type', 10)
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
            // Invoices only — each sale's delivery note repeats the same lines.
            ->where('dt.trans_type', 10)
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
            // Invoices only: every sale also has a delivery note with the same
            // lines, so counting all transaction types doubled every figure.
            ->where('dt.trans_type', 10)
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

    /**
     * Shift Day-End Summary — for a given shift, total sales broken down by
     * payment method (whatever the admin named each bank account — Cash,
     * Card, etc.), via the same pos_sale_shift_links tag + bank_trans/
     * cust_allocations records the checkout payment flow already writes.
     * Pure read aggregation — no new writes, no change to how a payment
     * posts.
     */
    public function shiftDayEndSummary(Request $request, int $shiftId)
    {
        $shift = DB::table('pos_shifts as s')
            ->leftJoin('user_managements as u', 'u.id', '=', 's.user_id')
            ->where('s.id', $shiftId)
            ->select('s.id', 's.user_id', 's.shift_start', 's.shift_end', 's.status', 's.opening_float', 's.closing_expected', 's.closing_counted', 's.variance')
            ->selectRaw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as cashier_name")
            ->first();

        if (!$shift) {
            return response()->json(['message' => 'Shift not found'], 404);
        }

        $byMethod = DB::table('pos_sale_shift_links as l')
            ->join('cust_allocations as ca', function ($join) {
                $join->on('ca.trans_no_to', '=', 'l.debtor_trans_no')
                     ->on('ca.trans_type_to', '=', 'l.debtor_trans_type');
            })
            ->join('bank_trans as bt', function ($join) {
                $join->on('bt.trans_no', '=', 'ca.trans_no_from')
                     ->where('bt.type', '=', 12); // SalesInvoiceService::TYPE_PAYMENT
            })
            ->join('bank_accounts as ba', 'ba.id', '=', 'bt.bank_act')
            ->where('l.pos_shift_id', $shiftId)
            ->select('ba.id as bank_account_id', 'ba.bank_account_name as method')
            ->selectRaw('SUM(bt.amount) as total')
            ->selectRaw('COUNT(DISTINCT l.debtor_trans_no) as bill_count')
            ->groupBy('ba.id', 'ba.bank_account_name')
            ->orderByDesc('total')
            ->get();

        return response()->json([
            'shift' => $shift,
            'by_payment_method' => $byMethod,
            'total_sales' => $byMethod->sum('total'),
        ]);
    }

    /**
     * Sales grouped by cashier and by shift, via the pos_sale_shift_links
     * tag written at checkout, plus sales by hour-of-day straight off
     * debtor_trans.created_at (no shift tag needed for that one).
     */
    public function salesByCashierShift(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());

        $byCashier = DB::table('pos_sale_shift_links as l')
            ->join('pos_shifts as s', 's.id', '=', 'l.pos_shift_id')
            ->join('user_managements as u', 'u.id', '=', 's.user_id')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'l.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'l.debtor_trans_type');
            })
            ->whereBetween('dt.tran_date', [$fromDate, $toDate])
            ->select('u.id as user_id')
            ->selectRaw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as cashier_name")
            ->selectRaw('COUNT(*) as bill_count')
            ->selectRaw('SUM(dt.ov_amount) as total_sales')
            ->groupBy('u.id', 'u.first_name', 'u.last_name')
            ->orderByDesc('total_sales')
            ->get();

        $byShift = DB::table('pos_sale_shift_links as l')
            ->join('pos_shifts as s', 's.id', '=', 'l.pos_shift_id')
            ->join('user_managements as u', 'u.id', '=', 's.user_id')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'l.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'l.debtor_trans_type');
            })
            ->whereBetween('dt.tran_date', [$fromDate, $toDate])
            ->select('s.id as shift_id', 's.shift_start', 's.shift_end', 's.status')
            ->selectRaw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as cashier_name")
            ->selectRaw('COUNT(*) as bill_count')
            ->selectRaw('SUM(dt.ov_amount) as total_sales')
            ->groupBy('s.id', 'u.first_name', 'u.last_name', 's.shift_start', 's.shift_end', 's.status')
            ->orderByDesc('s.shift_start')
            ->get();

        $byHour = DB::table('debtor_trans')
            ->where('trans_type', 10)
            ->whereBetween('tran_date', [$fromDate, $toDate])
            ->selectRaw('HOUR(created_at) as hour')
            ->selectRaw('COUNT(*) as bill_count')
            ->selectRaw('SUM(ov_amount) as total_sales')
            ->groupBy('hour')
            ->orderBy('hour')
            ->get();

        return response()->json([
            'by_cashier' => $byCashier,
            'by_shift' => $byShift,
            'by_hour' => $byHour,
        ]);
    }

    /**
     * Void Report — every sale that was cancelled after posting, with who
     * voided it and when, from the snapshot SalesInvoiceController::void()
     * writes right after the void already happened.
     */
    public function voidReport(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());

        $rows = DB::table('voided_sales_log as v')
            ->leftJoin('user_managements as u', 'u.id', '=', 'v.voided_by')
            ->whereBetween('v.voided_at', ["{$fromDate} 00:00:00", "{$toDate} 23:59:59"])
            ->select('v.trans_no', 'v.customer_name', 'v.amount', 'v.memo', 'v.voided_at')
            ->selectRaw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as voided_by_name")
            ->orderByDesc('v.voided_at')
            ->get();

        return response()->json([
            'voids' => $rows,
            'total_voided_amount' => $rows->sum('amount'),
        ]);
    }

    /**
     * Price-Override Audit — every checkout line where the cashier typed a
     * different unit price than the catalog price it was added at, from
     * the log SalesInvoiceController::logPriceOverrides() writes right
     * after the sale already posted.
     */
    public function priceOverrideAudit(Request $request)
    {
        $fromDate = $request->query('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->query('to_date', now()->toDateString());

        $rows = DB::table('price_override_log as p')
            ->leftJoin('user_managements as u', 'u.id', '=', 'p.cashier_id')
            ->leftJoin('stock_master as sm', 'sm.stock_id', '=', 'p.stock_id')
            ->whereBetween('p.created_at', ["{$fromDate} 00:00:00", "{$toDate} 23:59:59"])
            ->select('p.debtor_trans_no', 'sm.description', 'p.original_price', 'p.new_price', 'p.created_at')
            ->selectRaw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as cashier_name")
            ->orderByDesc('p.created_at')
            ->get();

        return response()->json($rows);
    }

    /**
     * Supplier Item List — every item a given supplier is registered to
     * supply, with the agreed price/UOM already on file (purch_data). Pure
     * read report, same table Purchase Order/GRN screens already use to
     * pre-fill supplier pricing.
     */
    public function supplierItemList(Request $request)
    {
        $supplierId = $request->query('supplier_id');

        $rows = DB::table('purch_data as pd')
            ->join('stock_master as sm', 'sm.stock_id', '=', 'pd.stock_id')
            ->join('suppliers as sup', 'sup.supplier_id', '=', 'pd.supplier_id')
            ->when($supplierId, fn ($q) => $q->where('pd.supplier_id', $supplierId))
            ->select(
                'sup.supplier_id', 'sup.supp_name',
                'pd.stock_id', 'sm.description', 'pd.price', 'pd.suppliers_uom', 'pd.conversion_factor'
            )
            ->orderBy('sup.supp_name')
            ->orderBy('sm.description')
            ->get();

        return response()->json($rows);
    }

    /**
     * Stock rows that have gone negative — always a data problem (oversold,
     * a missed GRN, a bad adjustment), never a real inventory state. Purely
     * a finder; fixing the number is still done through the normal
     * Inventory Audit / Stock Adjustment flow, not here.
     */
    public function negativeStock(Request $request)
    {
        $rows = DB::table('loc_stock as ls')
            ->join('stock_master as sm', 'sm.stock_id', '=', 'ls.stock_id')
            ->where('ls.quantity', '<', 0)
            ->when($request->filled('loc_code'), fn ($q) => $q->where('ls.loc_code', $request->query('loc_code')))
            ->select('ls.stock_id', 'sm.description', 'ls.loc_code', 'ls.quantity')
            ->orderBy('ls.quantity')
            ->get();

        return response()->json($rows);
    }

    /**
     * Outstanding gift voucher liability — active vouchers are money the
     * business owes the holder in goods, same idea as a customer credit.
     */
    public function voucherLiability()
    {
        $rows = DB::table('vouchers')
            ->where('status', 'active')
            ->where('balance', '>', 0)
            ->select('voucher_code', 'debtor_no', 'face_value', 'balance', 'issue_date', 'expiry_date')
            ->orderByDesc('balance')
            ->get();

        return response()->json([
            'vouchers' => $rows,
            'total_outstanding' => $rows->sum('balance'),
        ]);
    }

    /**
     * Debtor (receivables) aging — every unpaid customer invoice bucketed
     * by how overdue it is, same "ov_amount - alloc" outstanding formula
     * dashboardSummary() already uses for the debtor total.
     */
    public function receivablesAging()
    {
        return response()->json($this->agingReport('debtor_trans', 'debtor_no', 'debtors_master', 'name'));
    }

    /**
     * Creditor (payables) aging — same idea as receivablesAging() but for
     * money owed to suppliers.
     */
    public function payablesAging()
    {
        return response()->json($this->agingReport('supp_trans', 'supplier_id', 'suppliers', 'supp_name'));
    }

    private function agingReport(string $transTable, string $partyKey, string $partyTable, string $nameColumn)
    {
        $today = now()->toDateString();

        $rows = DB::table("{$transTable} as t")
            ->join("{$partyTable} as p", "p.{$partyKey}", '=', "t.{$partyKey}")
            ->selectRaw("t.{$partyKey} as party_id")
            ->selectRaw("p.{$nameColumn} as party_name")
            ->selectRaw('(t.ov_amount - t.alloc) as outstanding')
            ->selectRaw('t.due_date')
            ->havingRaw('outstanding > 0.01')
            ->get()
            ->groupBy('party_id');

        $result = $rows->map(function ($partyRows) use ($today) {
            $buckets = ['current' => 0, 'days_1_30' => 0, 'days_31_60' => 0, 'days_61_90' => 0, 'days_over_90' => 0];
            foreach ($partyRows as $row) {
                $daysOverdue = $row->due_date ? now()->diffInDays($row->due_date, false) * -1 : 0;
                if ($daysOverdue <= 0) {
                    $buckets['current'] += $row->outstanding;
                } elseif ($daysOverdue <= 30) {
                    $buckets['days_1_30'] += $row->outstanding;
                } elseif ($daysOverdue <= 60) {
                    $buckets['days_31_60'] += $row->outstanding;
                } elseif ($daysOverdue <= 90) {
                    $buckets['days_61_90'] += $row->outstanding;
                } else {
                    $buckets['days_over_90'] += $row->outstanding;
                }
            }
            $first = $partyRows->first();
            return array_merge(
                ['party_id' => $first->party_id, 'party_name' => $first->party_name],
                $buckets,
                ['total_outstanding' => array_sum($buckets)]
            );
        })->values();

        return $result;
    }

    /**
     * Personalized offer suggestions — read-only, staff-facing "hint", not
     * an automatic send. For each customer, finds their most-purchased
     * category over the lookback window, then checks whether an active
     * category-targeted Offer already exists for it. No new offer is
     * created and nothing is sent automatically — this only surfaces a
     * suggestion using data that already exists (purchase history +
     * existing Offers), same as the proposal's "personalized marketing"
     * idea, kept safely as a recommendation a staff member acts on.
     */
    public function customerOfferSuggestions(Request $request)
    {
        $lookbackDays = (int) $request->query('lookback_days', 365);
        $since = now()->subDays($lookbackDays)->toDateString();

        $rows = DB::table('debtor_trans_details as dtd')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'dtd.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'dtd.debtor_trans_type');
            })
            ->join('stock_master as sm', 'sm.stock_id', '=', 'dtd.stock_id')
            ->join('item_category as ic', 'ic.category_id', '=', 'sm.category_id')
            ->where('dt.tran_date', '>=', $since)
            ->select('dt.debtor_no', 'sm.category_id', 'ic.description as category_name')
            ->selectRaw('SUM(dtd.quantity) as qty')
            ->groupBy('dt.debtor_no', 'sm.category_id', 'ic.description')
            ->get();

        $topCategoryByDebtor = $rows->groupBy('debtor_no')
            ->map(fn ($group) => $group->sortByDesc('qty')->first());

        $categoryOffers = Offer::query()
            ->where('offer_type', 'category')
            ->where('status', 'active')
            ->get()
            ->keyBy(fn ($offer) => (string) $offer->target_id);

        $result = $topCategoryByDebtor->map(function ($row) use ($categoryOffers) {
            $offer = $categoryOffers->get((string) $row->category_id);

            return [
                'debtor_no' => $row->debtor_no,
                'preferred_category_id' => $row->category_id,
                'preferred_category_name' => $row->category_name,
                'suggested_offer_id' => $offer->id ?? null,
                'suggested_offer_name' => $offer->offer_name ?? null,
            ];
        })->values();

        return response()->json($result);
    }
}
