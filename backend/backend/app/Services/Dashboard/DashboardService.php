<?php

namespace App\Services\Dashboard;

use App\Support\ActiveFiscalYear;
use App\Models\FiscalYear;
use App\Services\Banking\BankBalanceService;
use App\Support\StockQuantityQuery;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardService
{
  public function __construct(private BankBalanceService $bankBalanceService)
  {
  }
  private const SALES_TYPES = [10, 11];

  private const PURCHASE_TYPES = [20, 21];

  /**
   * debtor_trans types stored with a positive ov_amount that actually reduce what
   * the customer owes: bank deposits/prepayments (2), credit notes (11), customer
   * payments (12). Mirrors CustomerCreditService::signedBalanceExpr().
   */
  private const CREDIT_REDUCING_DEBTOR_TYPES = [2, 11, 12];

  public function getSummary(): array
  {
    $ttl = (int) config('performance.dashboard_cache_seconds', 300);
    if ($ttl <= 0) {
      return $this->buildSummary();
    }

    $key = 'dashboard.summary.'.Carbon::today()->toDateString();

    return Cache::remember($key, $ttl, fn () => $this->buildSummary());
  }

  /** Lightweight alerts feed for navbar / notification center. */
  public function getAlerts(): array
  {
    $ttl = (int) config('performance.dashboard_alerts_cache_seconds', 120);
    if ($ttl <= 0) {
      return $this->buildAlerts(Carbon::today());
    }

    $key = 'dashboard.alerts.'.Carbon::today()->toDateString();

    return Cache::remember($key, $ttl, fn () => $this->buildAlerts(Carbon::today()));
  }

  public static function forgetCache(): void
  {
    $date = Carbon::today()->toDateString();
    Cache::forget('dashboard.summary.'.$date);
    Cache::forget('dashboard.alerts.'.$date);
  }

  private function buildSummary(): array
  {
    $today = Carbon::today();
    $mtdStart = $today->copy()->startOfMonth()->format('Y-m-d');
    $mtdEnd = $today->format('Y-m-d');
    $prevMonthStart = $today->copy()->subMonth()->startOfMonth()->format('Y-m-d');
    $prevMonthEnd = $today->copy()->subMonth()->endOfMonth()->format('Y-m-d');
    $fiscalRange = ActiveFiscalYear::range($today->toDateString());
    $yearStart = $fiscalRange['report_start'];
    $yearEnd = $fiscalRange['report_end'];

    $salesMtd = $this->sumDebtorNet($mtdStart, $mtdEnd);
    $salesPrev = $this->sumDebtorNet($prevMonthStart, $prevMonthEnd);
    $purchasesMtd = $this->sumSuppNet($mtdStart, $mtdEnd);
    $purchasesPrev = $this->sumSuppNet($prevMonthStart, $prevMonthEnd);

    return [
      'as_at' => $today->toDateString(),
      'period' => [
        'mtd_start' => $mtdStart,
        'mtd_end' => $mtdEnd,
        'fiscal_year_from' => $fiscalRange['fiscal_year_from'],
        'fiscal_year_to' => $fiscalRange['fiscal_year_to'],
        'fiscal_year_label' => $fiscalRange['label'],
        'fiscal_report_start' => $yearStart,
        'fiscal_report_end' => $yearEnd,
      ],
      'kpis' => [
        'sales_mtd' => [
          'value' => round($salesMtd, 2),
          'change' => $this->percentChange($salesMtd, $salesPrev),
        ],
        'purchases_mtd' => [
          'value' => round($purchasesMtd, 2),
          'change' => $this->percentChange($purchasesMtd, $purchasesPrev),
        ],
        'receivables' => [
          'value' => round($this->totalReceivables($mtdEnd), 2),
          'change' => 0,
        ],
        'payables' => [
          'value' => round($this->totalPayables($mtdEnd), 2),
          'change' => 0,
        ],
        'inventory_value' => [
          'value' => round($this->totalInventoryValue(), 2),
          'change' => 0,
        ],
        'bank_balance' => [
          'value' => round($this->totalBankBalance(), 2),
          'change' => 0,
        ],
      ],
      'sales_vs_purchases' => $this->monthlySalesVsPurchases($yearStart, $yearEnd),
      'module_distribution' => $this->moduleDistribution($mtdStart, $mtdEnd),
      'cash_flow' => $this->weeklyCashFlow(),
      'recent_activity' => $this->recentActivity(5),
      'alerts' => $this->buildAlerts($today),
    ];
  }

  private function percentChange(float $current, float $previous): float
  {
    if (abs($previous) < 0.001) {
      return $current > 0 ? 100 : 0;
    }

    return round((($current - $previous) / abs($previous)) * 100, 1);
  }

  private function debtorAmountExpr(): string
  {
    return 'IFNULL(t.ov_amount + t.ov_gst + t.ov_freight + t.ov_freight_tax + t.ov_discount, 0)';
  }

  private function signedDebtorBalanceExpr(): string
  {
    $types = implode(',', self::CREDIT_REDUCING_DEBTOR_TYPES);

    return '(CASE WHEN t.trans_type IN (' . $types . ') THEN -1 ELSE 1 END) * ('
      . $this->debtorAmountExpr() . ' - IFNULL(t.alloc, 0))';
  }

  private function debtorNetExpr(): string
  {
    return 'IFNULL(t.ov_amount + t.ov_gst + t.ov_freight + t.ov_freight_tax + t.ov_discount, 0)';
  }

  private function suppNetExpr(): string
  {
    return 'IFNULL(t.ov_amount + t.ov_gst - t.ov_discount, 0)';
  }

  private function sumDebtorNet(string $start, string $end): float
  {
    if (!Schema::hasTable('debtor_trans')) {
      return 0;
    }

    return (float) DB::table('debtor_trans as t')
      ->whereIn('t.trans_type', self::SALES_TYPES)
      ->whereBetween('t.tran_date', [$start, $end])
      ->sum(DB::raw($this->debtorNetExpr()));
  }

  private function sumSuppNet(string $start, string $end): float
  {
    if (!Schema::hasTable('supp_trans')) {
      return 0;
    }

    return (float) DB::table('supp_trans as t')
      ->whereIn('t.trans_type', self::PURCHASE_TYPES)
      ->whereBetween('t.trans_date', [$start, $end])
      ->sum(DB::raw($this->suppNetExpr()));
  }

  private function totalReceivables(string $asAt): float
  {
    if (!Schema::hasTable('debtor_trans')) {
      return 0;
    }

    $rows = DB::table('debtor_trans as t')
      ->selectRaw(
        'SUM(' . $this->signedDebtorBalanceExpr() . ') as balance'
      )
      ->where(function ($q) use ($asAt) {
        $q->where('t.tran_date', '<=', $asAt)->orWhereNull('t.tran_date');
      })
      ->groupBy('t.debtor_no')
      ->havingRaw('ABS(SUM(' . $this->signedDebtorBalanceExpr() . ')) > 0.001')
      ->get();

    return (float) $rows->sum('balance');
  }

  private function totalPayables(string $asAt): float
  {
    if (!Schema::hasTable('supp_trans')) {
      return 0;
    }

    $rows = DB::table('supp_trans as t')
      ->selectRaw('SUM(IFNULL(t.ov_amount + t.ov_gst - t.alloc, 0)) as balance')
      ->where(function ($q) use ($asAt) {
        $q->where('t.trans_date', '<=', $asAt)->orWhereNull('t.trans_date');
      })
      ->groupBy('t.supplier_id')
      ->havingRaw('ABS(SUM(IFNULL(t.ov_amount + t.ov_gst - t.alloc, 0))) > 0.001')
      ->get();

    return (float) $rows->sum('balance');
  }

  private function totalInventoryValue(): float
  {
    return StockQuantityQuery::totalValue();
  }

  private function totalBankBalance(): float
  {
    return $this->bankBalanceService->getTotalBalance();
  }

  private function monthlySalesVsPurchases(string $yearStart, string $end): array
  {
    $months = [];
    $cursor = Carbon::parse($yearStart)->startOfMonth();
    $endDate = Carbon::parse($end);

    while ($cursor->lte($endDate)) {
      $monthStart = $cursor->copy()->startOfMonth()->format('Y-m-d');
      $monthEnd = $cursor->copy()->endOfMonth()->format('Y-m-d');
      if ($cursor->isSameMonth($endDate)) {
        $monthEnd = $end;
      }

      $months[] = [
        'name' => $cursor->format('M'),
        'sales' => round($this->sumDebtorNet($monthStart, $monthEnd), 2),
        'purchases' => round($this->sumSuppNet($monthStart, $monthEnd), 2),
      ];

      $cursor->addMonth();
    }

    return $months;
  }

  private function moduleDistribution(string $start, string $end): array
  {
    $counts = [
      ['name' => 'Sales', 'value' => 0],
      ['name' => 'Purchases', 'value' => 0],
      ['name' => 'Banking & GL', 'value' => 0],
      ['name' => 'Inventory', 'value' => 0],
      ['name' => 'Manufacturing', 'value' => 0],
    ];

    if (Schema::hasTable('debtor_trans')) {
      $counts[0]['value'] = (int) DB::table('debtor_trans')
        ->whereBetween('tran_date', [$start, $end])
        ->count();
    }

    if (Schema::hasTable('supp_trans')) {
      $counts[1]['value'] = (int) DB::table('supp_trans')
        ->whereBetween('trans_date', [$start, $end])
        ->count();
    }

    if (Schema::hasTable('bank_trans')) {
      $counts[2]['value'] = (int) DB::table('bank_trans')
        ->whereBetween('trans_date', [$start, $end])
        ->count();
    }

    if (Schema::hasTable('gl_trans') && Schema::hasColumn('gl_trans', 'date')) {
      $counts[2]['value'] += (int) DB::table('gl_trans')
        ->whereBetween('date', [$start, $end])
        ->count();
    }

    if (Schema::hasTable('stock_moves')) {
      $counts[3]['value'] = (int) DB::table('stock_moves')
        ->whereBetween('tran_date', [$start, $end])
        ->count();
    }

    if (Schema::hasTable('workorders')) {
      $dateCol = Schema::hasColumn('workorders', 'released_date') ? 'released_date' : 'date';
      $counts[4]['value'] = (int) DB::table('workorders')
        ->whereBetween($dateCol, [$start, $end])
        ->count();
    }

    return array_values(array_filter($counts, fn ($row) => $row['value'] > 0));
  }

  private function weeklyCashFlow(): array
  {
    if (!Schema::hasTable('bank_trans')) {
      return [];
    }

    $weeks = [];
    $today = Carbon::today();

    for ($i = 3; $i >= 0; $i--) {
      $weekEnd = $today->copy()->subWeeks($i);
      $weekStart = $weekEnd->copy()->subDays(6);
      $start = $weekStart->format('Y-m-d');
      $end = $weekEnd->format('Y-m-d');

      $inflow = (float) DB::table('bank_trans')
        ->whereBetween('trans_date', [$start, $end])
        ->sum(DB::raw('CASE WHEN amount > 0 THEN amount ELSE 0 END'));

      $outflow = (float) DB::table('bank_trans')
        ->whereBetween('trans_date', [$start, $end])
        ->sum(DB::raw('CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END'));

      $weeks[] = [
        'name' => 'W' . (4 - $i),
        'inflow' => round($inflow, 2),
        'outflow' => round($outflow, 2),
      ];
    }

    return $weeks;
  }

  private function recentActivity(int $limit): array
  {
    $items = collect();

    if (Schema::hasTable('debtor_trans')) {
      $typeJoin = Schema::hasTable('trans_types');
      $query = DB::table('debtor_trans as t');
      if ($typeJoin) {
        $query->leftJoin('trans_types as tt', 't.trans_type', '=', 'tt.trans_type');
      }

      $rows = $query
        ->select(
          't.id',
          't.reference',
          't.tran_date as activity_date',
          DB::raw($typeJoin ? 'COALESCE(tt.description, "Sales") as activity_type' : '"Sales" as activity_type'),
          DB::raw($this->debtorNetExpr() . ' as amount'),
          DB::raw('"Posted" as status')
        )
        ->whereNotNull('t.tran_date')
        ->orderByDesc('t.tran_date')
        ->orderByDesc('t.id')
        ->limit($limit)
        ->get();

      $items = $items->concat($this->mapActivityRows($rows, 'sales'));
    }

    if (Schema::hasTable('supp_trans')) {
      $typeJoin = Schema::hasTable('trans_types');
      $query = DB::table('supp_trans as t');
      if ($typeJoin) {
        $query->leftJoin('trans_types as tt', 't.trans_type', '=', 'tt.trans_type');
      }

      $rows = $query
        ->select(
          't.id',
          't.reference',
          't.trans_date as activity_date',
          DB::raw($typeJoin ? 'COALESCE(tt.description, "Purchase") as activity_type' : '"Purchase" as activity_type'),
          DB::raw($this->suppNetExpr() . ' as amount'),
          DB::raw('CASE WHEN ABS(IFNULL(t.ov_amount + t.ov_gst - t.alloc, 0)) > 0.001 THEN "Pending" ELSE "Posted" END as status')
        )
        ->whereNotNull('t.trans_date')
        ->orderByDesc('t.trans_date')
        ->orderByDesc('t.id')
        ->limit($limit)
        ->get();

      $items = $items->concat($this->mapActivityRows($rows, 'purchase'));
    }

    if (Schema::hasTable('bank_trans')) {
      $rows = DB::table('bank_trans as bt')
        ->leftJoin('bank_accounts as ba', 'bt.bank_act', '=', 'ba.id')
        ->select(
          'bt.id',
          'bt.ref as reference',
          'bt.trans_date as activity_date',
          DB::raw('CONCAT("Bank ", COALESCE(ba.bank_name, "")) as activity_type'),
          'bt.amount',
          DB::raw('"Posted" as status')
        )
        ->whereNotNull('bt.trans_date')
        ->orderByDesc('bt.trans_date')
        ->orderByDesc('bt.id')
        ->limit($limit)
        ->get();

      $items = $items->concat($this->mapActivityRows($rows, 'bank'));
    }

    if (Schema::hasTable('journal')) {
      $rows = DB::table('journal as j')
        ->select(
          DB::raw('CONCAT(j.type, "-", j.trans_no) as id'),
          'j.reference',
          'j.tran_date as activity_date',
          DB::raw('"GL Journal" as activity_type'),
          'j.amount',
          DB::raw('"Posted" as status')
        )
        ->whereNotNull('j.tran_date')
        ->orderByDesc('j.tran_date')
        ->orderByDesc('j.trans_no')
        ->limit($limit)
        ->get();

      $items = $items->concat($this->mapActivityRows($rows, 'journal'));
    }

    return $items
      ->sortByDesc(fn ($row) => $row['sort_date'])
      ->take($limit)
      ->values()
      ->map(fn ($row) => [
        'id' => $row['id'],
        'type' => $row['type'],
        'ref' => $row['ref'],
        'amount' => $row['amount'],
        'status' => $row['status'],
        'time' => $row['time'],
      ])
      ->all();
  }

  private function mapActivityRows(Collection $rows, string $prefix): Collection
  {
    return $rows->map(function ($row) use ($prefix) {
      $date = $row->activity_date ? Carbon::parse($row->activity_date) : Carbon::now();
      $amount = (float) ($row->amount ?? 0);

      return [
        'id' => $prefix . '-' . $row->id,
        'type' => $row->activity_type ?? 'Transaction',
        'ref' => $row->reference ?: '—',
        'amount' => abs($amount) > 0.001 ? round($amount, 2) : null,
        'status' => $row->status ?? 'Posted',
        'time' => $date->diffForHumans(),
        'sort_date' => $date->format('Y-m-d H:i:s'),
      ];
    });
  }

  private function buildAlerts(Carbon $today): array
  {
    $alerts = [];

    $reorderCount = $this->countBelowReorder();
    if ($reorderCount > 0) {
      $alerts[] = [
        'label' => $reorderCount . ' item(s) below reorder level',
        'severity' => 'warning',
        'type' => 'reorder_level',
      ];
    }

    $overdueCount = $this->countOverdueReceivables($today);
    if ($overdueCount > 0) {
      $alerts[] = [
        'label' => $overdueCount . ' overdue customer invoice(s)',
        'severity' => 'warning',
        'type' => 'overdue_receivables',
      ];
    }

    $pendingPoCount = $this->countOpenPurchaseOrders();
    if ($pendingPoCount > 0) {
      $alerts[] = [
        'label' => $pendingPoCount . ' open purchase order(s)',
        'severity' => 'info',
        'type' => 'open_purchase_orders',
      ];
    }

    $fiscalAlert = $this->fiscalYearAlert($today);
    if ($fiscalAlert) {
      $fiscalAlert['type'] = 'fiscal_year';
      $alerts[] = $fiscalAlert;
    }

    if (Schema::hasTable('gl_trans')) {
      try {
        if (Schema::hasColumn('gl_trans', 'debit') && Schema::hasColumn('gl_trans', 'credit')) {
          $totals = DB::table('gl_trans')
            ->selectRaw('COALESCE(SUM(debit),0) as debits, COALESCE(SUM(credit),0) as credits')
            ->first();
          $diff = abs((float) ($totals->debits ?? 0) - (float) ($totals->credits ?? 0));
          if ($diff >= 0.01) {
            $alerts[] = [
              'label' => 'GL out of balance by ' . number_format($diff, 2),
              'severity' => 'warning',
              'type' => 'gl_imbalance',
            ];
          }
        }
      } catch (\Throwable) {
        // ignore
      }
    }

    return $alerts;
  }

  private function countBelowReorder(): int
  {
    if (!Schema::hasTable('loc_stock') || !Schema::hasTable('stock_moves')) {
      return 0;
    }

    return (int) DB::table('loc_stock as ls')
      ->joinSub(
        DB::table('stock_moves')
          ->select('stock_id', 'loc_code', DB::raw('SUM(qty) as qty'))
          ->groupBy('stock_id', 'loc_code'),
        'mv',
        function ($join) {
          $join->on('ls.stock_id', '=', 'mv.stock_id')
            ->on('ls.loc_code', '=', 'mv.loc_code');
        }
      )
      ->where('ls.reorder_level', '>', 0)
      ->whereRaw('mv.qty < ls.reorder_level')
      ->count();
  }

  private function countOverdueReceivables(Carbon $today): int
  {
    if (!Schema::hasTable('debtor_trans')) {
      return 0;
    }

    return (int) DB::table('debtor_trans as t')
      ->where('t.due_date', '<', $today->format('Y-m-d'))
      // Payments/credit notes/deposits aren't themselves "receivables" that can be overdue.
      ->whereNotIn('t.trans_type', self::CREDIT_REDUCING_DEBTOR_TYPES)
      ->whereRaw(
        'ABS(' . $this->debtorAmountExpr() . ' - IFNULL(t.alloc, 0)) > 0.001'
      )
      ->count();
  }

  private function countOpenPurchaseOrders(): int
  {
    if (!Schema::hasTable('purch_orders')) {
      return 0;
    }

    return (int) DB::table('purch_orders')
      ->whereRaw('ABS(IFNULL(total, 0) - IFNULL(alloc, 0)) > 0.001')
      ->count();
  }

  private function fiscalYearAlert(Carbon $today): ?array
  {
    if (!Schema::hasTable('fiscal_years')) {
      return null;
    }

    $open = FiscalYear::query()
      ->where('closed', 0)
      ->whereDate('fiscal_year_from', '<=', $today)
      ->whereDate('fiscal_year_to', '>=', $today)
      ->first();

    if (!$open) {
      return [
        'label' => 'No open fiscal year includes today',
        'severity' => 'warning',
      ];
    }

    $end = Carbon::parse($open->fiscal_year_to);
    $daysLeft = $today->diffInDays($end, false);

    if ($daysLeft >= 0 && $daysLeft <= 30) {
      return [
        'label' => 'Fiscal year ends in ' . ($daysLeft + 1) . ' day(s)',
        'severity' => 'info',
      ];
    }

    return null;
  }
}
