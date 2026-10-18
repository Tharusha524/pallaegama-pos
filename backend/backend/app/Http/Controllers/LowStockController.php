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

        $rows = DB::table('stock_master as sm')
            ->leftJoin('loc_stock as ls', 'ls.stock_id', '=', 'sm.stock_id')
            ->select(
                'sm.stock_id',
                'sm.description',
                DB::raw("COALESCE(ls.loc_code, 'N/A') as loc_code"),
                DB::raw('COALESCE(ls.quantity, 0) as quantity'),
                DB::raw('COALESCE(ls.reorder_level, 0) as reorder_level'),
                'sm.purchase_cost',
                'sm.eoq_ordering_cost',
                'sm.eoq_holding_cost_percent'
            )
            ->where('sm.inactive', false)
            ->whereRaw('COALESCE(ls.quantity, 0) <= COALESCE(ls.reorder_level, 0)')
            ->when($request->filled('loc_code'), fn ($q) => $q->where('ls.loc_code', $request->query('loc_code')))
            ->get();

        $avgDailySales = DB::table('debtor_trans_details as dtd')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'dtd.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'dtd.debtor_trans_type');
            })
            ->where('dt.tran_date', '>=', $since)
            // Invoices only — each sale's delivery note repeats the same lines.
            ->where('dt.trans_type', 10)
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

            // EOQ = sqrt(2 * annual demand * ordering cost / annual holding
            // cost per unit). Annual demand comes from this item's actual
            // sales history (avg daily x365) — only null when the item's
            // two EOQ inputs haven't been set yet (Set Price -> EOQ Setup).
            $eoqQuantity = null;
            if ($row->eoq_ordering_cost !== null && $row->eoq_holding_cost_percent !== null && $row->purchase_cost > 0) {
                $annualDemand = $avgDaily * 365;
                $holdingCostPerUnit = ($row->eoq_holding_cost_percent / 100) * $row->purchase_cost;
                if ($annualDemand > 0 && $holdingCostPerUnit > 0) {
                    $eoqQuantity = round(sqrt((2 * $annualDemand * $row->eoq_ordering_cost) / $holdingCostPerUnit));
                }
            }

            return [
                'stock_id' => $row->stock_id,
                'description' => $row->description,
                'loc_code' => $row->loc_code,
                'quantity' => $row->quantity,
                'reorder_level' => $row->reorder_level,
                'avg_daily_sales' => round($avgDaily, 2),
                'days_of_stock_remaining' => $daysRemaining,
                'eoq_quantity' => $eoqQuantity,
                'status' => $status,
            ];
        });

        return response()->json($result->values());
    }
}
