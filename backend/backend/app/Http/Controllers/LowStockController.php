<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LowStockController extends Controller
{
    /**
     * Items at or below their reorder level, with an estimated days-of-stock-remaining
     * figure based on average daily sales over the last 30 days.
     */
    public function index(Request $request)
    {
        $lookbackDays = (int) $request->query('lookback_days', 30);
        $since = now()->subDays($lookbackDays)->toDateString();

        $rows = DB::table('loc_stock as ls')
            ->join('stock_master as sm', 'sm.stock_id', '=', 'ls.stock_id')
            ->select(
                'ls.stock_id',
                'sm.description',
                'ls.loc_code',
                'ls.quantity',
                'ls.reorder_level'
            )
            ->whereNotNull('ls.reorder_level')
            ->whereColumn('ls.quantity', '<=', 'ls.reorder_level')
            ->when($request->filled('loc_code'), fn ($q) => $q->where('ls.loc_code', $request->query('loc_code')))
            ->get();

        $avgDailySales = DB::table('debtor_trans_details as dtd')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'dtd.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'dtd.debtor_trans_type');
            })
            ->where('dt.tran_date', '>=', $since)
            ->select('dtd.stock_id')
            ->selectRaw('SUM(dtd.quantity) / GREATEST(DATEDIFF(NOW(), ?), 1) as avg_daily_qty', [$since])
            ->groupBy('dtd.stock_id')
            ->pluck('avg_daily_qty', 'stock_id');

        $result = $rows->map(function ($row) use ($avgDailySales) {
            $avgDaily = (float) ($avgDailySales[$row->stock_id] ?? 0);
            $daysRemaining = $avgDaily > 0 ? round($row->quantity / $avgDaily, 1) : null;

            $status = 'ok';
            if ($row->quantity <= 0) {
                $status = 'critical';
            } elseif ($row->quantity <= $row->reorder_level) {
                $status = 'low';
            }

            return [
                'stock_id' => $row->stock_id,
                'description' => $row->description,
                'loc_code' => $row->loc_code,
                'quantity' => $row->quantity,
                'reorder_level' => $row->reorder_level,
                'avg_daily_sales' => round($avgDaily, 2),
                'days_of_stock_remaining' => $daysRemaining,
                'status' => $status,
            ];
        });

        return response()->json($result->values());
    }
}
