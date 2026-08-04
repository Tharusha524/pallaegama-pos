<?php

namespace App\Services\Reports;

use App\Repositories\All\BalanceSheet\BalanceSheetInterface;
use App\Repositories\All\CostCenter\CostCenterInterface;
use App\Repositories\All\GlTrans\GlTransInterface;
use App\Repositories\All\Journal\JournalInterface;
use App\Repositories\All\ProfitAndLoss\ProfitAndLossInterface;
use App\Repositories\All\Reports\ReportsInterface;
use App\Repositories\All\TaxInquiry\TaxInquiryInterface;
use App\Repositories\All\TrialBalance\TrialBalanceInterface;
use App\Services\CompanyReportHeader;
use App\Support\ActiveFiscalYear;
use App\Support\ChartAccountMetadata;
use App\Support\CostCenterGlBalance;
use App\Support\ProfitAndLossStatementBuilder;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ReportPdfBuilder
{
    public function __construct(
        private ReportsInterface $reports,
        private TrialBalanceInterface $trialBalance,
        private BalanceSheetInterface $balanceSheet,
        private ProfitAndLossInterface $profitAndLoss,
        private GlTransInterface $glTrans,
        private JournalInterface $journal,
        private TaxInquiryInterface $taxInquiry,
        private CostCenterInterface $costCenters,
    ) {
    }

    private function normalizeRows(mixed $data): Collection
    {
        if ($data instanceof Collection) {
            return $data;
        }
        if (is_array($data)) {
            if (array_key_exists('rows', $data)) {
                $rows = $data['rows'];

                return $rows instanceof Collection ? $rows : collect($rows);
            }

            return collect($data);
        }

        return collect();
    }

    private function normalizeCostCenter(mixed $costCenter): ?string
    {
        if ($costCenter === null || $costCenter === '' || $costCenter === '0') {
            return null;
        }
        $value = strtolower(trim((string) $costCenter));
        if (in_array($value, ['all', 'nofilter', 'no', 'none'], true)) {
            return null;
        }

        return (string) $costCenter;
    }

    /** @return array{fromDate: string, toDate: string, costCenter: ?string} */
    private function reportDates(Request $request): array
    {
        return [
            'fromDate' => (string) ($request->input('startDate', $request->input('fromDate', ''))),
            'toDate' => (string) ($request->input('endDate', $request->input('toDate', ''))),
            'costCenter' => $this->normalizeCostCenter($request->input('costCenter')),
        ];
    }

    public function build(string $reportKey, Request $request): array
    {
        $title = $request->input('title') ?: $this->defaultTitle($reportKey);
        $payload = match ($reportKey) {
            'sales-module-report' => $this->moduleSnapshot($request, $title, 'sales'),
            'purchases-module-report' => $this->moduleSnapshot($request, $title, 'purchases'),
            'items-module-report' => $this->moduleSnapshot($request, $title, 'items'),
            'inventory-module-report' => $this->moduleSnapshot($request, $title, 'inventory'),
            'manufacturing-module-report' => $this->moduleSnapshot($request, $title, 'manufacturing'),
            'fixed-assets-module-report' => $this->moduleSnapshot($request, $title, 'fixed-assets'),
            'cost-centers-module-report' => $this->moduleSnapshot($request, $title, 'cost-centers'),
            'banking-module-report' => $this->moduleSnapshot($request, $title, 'banking'),
            'general-ledger-module-report' => $this->moduleSnapshot($request, $title, 'general-ledger'),
            'customer-balances' => $this->customerBalances($request, $title),
            'aged-customer-analysis' => $this->agedCustomerAnalysis($request, $title),
            'customer-trial-balance' => $this->customerTrialBalance($request, $title),
            'customer-detail-listing' => $this->customerDetailListing($request, $title),
            'sales-summary-report' => $this->salesSummary($request, $title),
            'supplier-balances' => $this->supplierBalances($request, $title),
            'aged-supplier-analyses' => $this->supplierAged($request, $title),
            'trial-balance' => $this->trialBalanceReport($request, $title),
            'balance-sheet' => $this->balanceSheetReport($request, $title),
            'profit-and-loss-statement' => $this->profitAndLossReport($request, $title),
            'chart-of-accounts' => $this->chartOfAccounts($request, $title),
            'gl-account-transactions' => $this->glTransactions($request, $title),
            'list-of-journal-entries' => $this->journalEntries($request, $title),
            'tax-report' => $this->taxReport($request, $title),
            'audit-trail' => $this->auditTrailReport($request, $title),
            'annual-expense-breakdown' => $this->annualExpenseBreakdown($request, $title),
            'cost-center-summary' => $this->costCenterSummary($request, $title),
            'bank-statement' => $this->bankStatement($request, $title, false),
            'bank-statement-w-reconcile' => $this->bankStatement($request, $title, true),
            'fixed-assets-valuation' => $this->fixedAssetsValuation($request, $title),
            'inventory-valuation' => $this->inventoryValuation($request, $title),
            'print-invoices' => $this->debtorTransReport($request, $title, [10], 'Sales Invoices'),
            'print-credit-notes' => $this->debtorTransReport($request, $title, [11], 'Credit Notes'),
            'print-deliveries' => $this->debtorTransReport($request, $title, [13], 'Deliveries'),
            'print-receipts' => $this->debtorTransReport($request, $title, [12], 'Customer Receipts'),
            'print-sales-orders' => $this->debtorTransReport($request, $title, [30], 'Sales Orders'),
            'print-purchase-orders' => $this->printPurchaseOrders($request, $title),
            'payment-report' => $this->suppTransReport($request, $title, [22], 'Supplier Payments'),
            'price-listing' => $this->priceListing($request, $title),
            'order-status-listing' => $this->orderStatusListing($request, $title),
            'salesman-listing' => $this->salesmanListing($request, $title),
            'print-statements' => $this->printStatements($request, $title),
            'print-sales-quotations' => $this->printSalesQuotations($request, $title),
            'supplier-trial-balances' => $this->supplierTrialBalances($request, $title),
            'outstanding-grns-report' => $this->outstandingGrnsReport($request, $title),
            'supplier-detail-listing' => $this->supplierDetailListing($request, $title),
            'print-remittances' => $this->suppTransReport($request, $title, [22], 'Supplier Remittances'),
            'inventory-planning' => $this->inventoryPlanning($request, $title),
            'stock-check-sheets' => $this->stockCheckSheets($request, $title),
            'inventory-sales-report' => $this->inventorySalesReport($request, $title),
            'grn-valuation-report' => $this->grnValuationReport($request, $title),
            'inventory-purchasing-report' => $this->inventoryPurchasingReport($request, $title),
            'inventory-movement-report' => $this->inventoryMovementReport($request, $title),
            'costed-inventory-movement-report' => $this->costedInventoryMovementReport($request, $title),
            'item-sales-summary-report' => $this->itemSalesSummaryReport($request, $title),
            'inventory-purchasing-transaction-based' => $this->inventoryPurchasingTransactionBased($request, $title),
            'bill-of-material-listing' => $this->billOfMaterialListing($request, $title),
            'work-order-listing' => $this->workOrderListing($request, $title),
            'print-work-orders' => $this->printWorkOrders($request, $title),
            default => $this->fallback($request, $title, $reportKey),
        };

        return $payload;
    }

    private function defaultTitle(string $key): string
    {
        return Str::title(str_replace('-', ' ', $key));
    }

    private function flatParams(Request $request): array
    {
        $skip = ['title', 'reportKey', 'orientation', 'destination', 'comments'];
        $out = [];
        foreach ($request->except($skip) as $k => $v) {
            if ($v === null || $v === '') {
                continue;
            }
            $out[Str::title(str_replace('_', ' ', $k))] = is_bool($v) ? ($v ? 'Yes' : 'No') : (string) $v;
        }
        return $out;
    }

    /** Fields that must never be formatted as currency (GL codes, IDs, references). */
    private const PDF_IDENTIFIER_FIELDS = [
        'account',
        'account_code',
        'code',
        'debtor_no',
        'supplier_id',
        'stock_id',
        'item_code',
        'parent',
        'component',
        'trans_no',
        'order_no',
        'id',
        'gl_seq',
        'reference',
        'salesman_code',
        'account_type',
        'type',
        'trans_type',
        'sales_type_id',
        'tax_group_id',
        'loc_code',
        'curr_code',
        'curr_abrev',
        'tax_id',
        'achievepercent',
        'inactive',
    ];

    private function formatPdfCell(string $field, mixed $val): string
    {
        if ($val === null || $val === '') {
            return '';
        }

        if (!is_numeric($val)) {
            return (string) $val;
        }

        $key = strtolower(str_replace(['-', ' '], '_', $field));
        if (in_array($key, self::PDF_IDENTIFIER_FIELDS, true)) {
            return trim((string) $val);
        }

        if (
            preg_match(
                '/(?:debit|credit|amount|balance|total|price|value|cost|period|opening|closing|charges|credits|allocated|depreciation|book_value|net_|tax_|sales_value|unit_price|standard_cost|cost_value|turnover|broughtforward|thisperiod|compare|qty|quantity|reorder|on_hand|provision)/i',
                $key
            )
        ) {
            return number_format((float) $val, 2);
        }

        // Other numeric values (counts, IDs): no currency formatting.
        if ((float) $val == (int) $val) {
            return (string) (int) $val;
        }

        return number_format((float) $val, 2);
    }

    private function pack(string $title, array $headers, Collection|array $data, Request $request, ?string $subtitle = null): array
    {
        $rows = [];
        foreach ($data as $item) {
            $row = [];
            $obj = (array) $item;
            foreach (array_keys($headers) as $field) {
                $val = $obj[$field] ?? '';
                $row[] = $this->formatPdfCell($field, $val);
            }
            $rows[] = $row;
        }

        return array_merge([
            'title' => $title,
            'subtitle' => $subtitle,
            'headers' => array_values($headers),
            'rows' => $rows,
            'parameters' => count($rows) === 0 ? $this->flatParams($request) : [],
        ], [
            'companyHeader' => CompanyReportHeader::forReports(),
        ]);
    }

    private function customerBalances(Request $request, string $title): array
    {
        $data = $this->reports->getCustomerBalancesData($request);
        $subtitle = $request->input('startDate', '') . ' to ' . $request->input('endDate', now()->format('Y-m-d'));
        return $this->pack($title, [
            'trans_type' => 'Trans Type',
            'number' => '#',
            'date' => 'Date',
            'due_date' => 'Due Date',
            'debits' => 'Debits',
            'credits' => 'Credits',
            'allocated' => 'Allocated',
            'outstanding_balance' => 'Outstanding',
        ], $data, $request, $subtitle);
    }

    private function agedCustomerAnalysis(Request $request, string $title): array
    {
        $data = $this->reports->getAgedCustomerAnalysisData($request);
        return $this->pack($title, [
            'debtor_no' => 'Customer #',
            'name' => 'Name',
            'curr_code' => 'Currency',
            'current' => 'Current',
            'age1' => '1-30',
            'age2' => '31-60',
            'age3' => '60+',
            'balance' => 'Total',
        ], $data, $request, 'As at: ' . $request->input('endDate', now()->format('Y-m-d')));
    }

    private function customerTrialBalance(Request $request, string $title): array
    {
        $data = $this->reports->getCustomerTrialBalanceData($request);
        return $this->pack($title, [
            'debtor_no' => 'Customer #',
            'name' => 'Name',
            'opening_balance' => 'Opening',
            'debits' => 'Debits',
            'credits' => 'Credits',
            'closing_balance' => 'Closing',
        ], $data, $request, $request->input('startDate') . ' to ' . $request->input('endDate'));
    }

    private function customerDetailListing(Request $request, string $title): array
    {
        $data = $this->reports->getCustomerDetailListingData($request);
        return $this->pack($title, [
            'debtor_no' => 'Customer #',
            'name' => 'Name',
            'br_name' => 'Branch',
            'phone' => 'Phone',
            'email' => 'Email',
            'turnover' => 'Turnover',
        ], $data, $request);
    }

    private function salesSummary(Request $request, string $title): array
    {
        $data = $this->reports->getSalesSummaryData($request);
        return $this->pack($title, [
            'debtor_no' => 'Customer #',
            'name' => 'Name',
            'tax_id' => 'Tax ID',
            'net_amount' => 'Net',
            'tax_amount' => 'Tax',
        ], $data, $request, $request->input('startDate') . ' to ' . $request->input('endDate'));
    }

    private function supplierBalances(Request $request, string $title): array
    {
        $date = $request->input('endDate', now()->format('Y-m-d'));
        $supplierFilter = $request->input('supplier', 'NoFilter');
        $balanceExpr = 'IFNULL(t.ov_amount + t.ov_gst - t.ov_discount - t.alloc, 0)';

        $query = DB::table('suppliers as s')
            ->leftJoin('supp_trans as t', function ($join) use ($date) {
                $join->on('s.supplier_id', '=', 't.supplier_id')
                    ->where('t.trans_date', '<=', $date);
            })
            ->select(
                's.supplier_id',
                's.supp_name as name',
                DB::raw("SUM({$balanceExpr}) as balance")
            )
            ->groupBy('s.supplier_id', 's.supp_name')
            ->havingRaw("ABS(SUM({$balanceExpr})) > 0.001");

        if ($supplierFilter && $supplierFilter !== 'NoFilter' && $supplierFilter !== '') {
            $query->where('s.supplier_id', (int) $supplierFilter);
        }

        $data = $query->get();

        return $this->pack($title, [
            'supplier_id' => 'Supplier #',
            'name' => 'Name',
            'balance' => 'Balance',
        ], $data, $request, 'As at: ' . $date);
    }

    private function supplierAged(Request $request, string $title): array
    {
        $data = $this->reports->getAgedSupplierAnalysisData($request);

        return $this->pack($title, [
            'supplier_id' => 'Supplier #',
            'name' => 'Name',
            'curr_code' => 'Currency',
            'current' => 'Current',
            'age1' => '1-30',
            'age2' => '31-60',
            'age3' => '60+',
            'balance' => 'Total',
        ], $data, $request, 'As at: ' . $request->input('endDate', now()->format('Y-m-d')));
    }

    private function trialBalanceReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $data = $this->trialBalance->search([
            'fromDate' => $dates['fromDate'],
            'toDate' => $dates['toDate'],
            'costCenter' => $dates['costCenter'],
            'noZeroValues' => ($request->input('zeroValues', 'no') === 'yes'),
            'onlyBalance' => ($request->input('onlyBalances', 'no') === 'yes'),
        ]);

        return $this->pack($title, [
            'account' => 'Account',
            'accountName' => 'Name',
            'broughtForwardDebit' => 'BF Debit',
            'broughtForwardCredit' => 'BF Credit',
            'thisPeriodDebit' => 'Period Debit',
            'thisPeriodCredit' => 'Period Credit',
            'balanceDebit' => 'Bal Debit',
            'balanceCredit' => 'Bal Credit',
        ], $this->normalizeRows($data), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function balanceSheetReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $result = $this->balanceSheet->search([
            'asAtDate' => $request->input('asAtDate', $dates['toDate']),
            'fromDate' => $dates['fromDate'],
            'toDate' => $dates['toDate'],
            'costCenter' => $dates['costCenter'],
        ]);

        $rows = collect($result['rows'] ?? []);
        $grouped = [];

        foreach ($rows as $row) {
            $r = (array) $row;
            $className = (string) ($r['className'] ?? $r['class'] ?? 'Other');
            $typeName = (string) ($r['typeName'] ?? $r['type'] ?? 'General');
            $classId = (string) ($r['classId'] ?? $r['class_id'] ?? '');

            if (!isset($grouped[$className])) {
                $grouped[$className] = [
                    '_meta' => ['classId' => $classId],
                ];
            }

            if (!isset($grouped[$className][$typeName])) {
                $grouped[$className][$typeName] = [];
            }

            $grouped[$className][$typeName][] = $r;
        }

        return [
            'view' => 'reports.balance_sheet',
            'title' => $title,
            'subtitle' => $this->periodSubtitle($dates['fromDate'], $dates['toDate']),
            'grouped' => $grouped,
            'totals' => $result['totals'] ?? [],
            'companyHeader' => CompanyReportHeader::forReports(),
        ];
    }

    private function profitAndLossReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $compareTo = (string) $request->input('compareTo', 'Accumulated');
        $rows = $this->profitAndLoss->search([
            'fromDate' => $dates['fromDate'],
            'toDate' => $dates['toDate'],
            'compareTo' => $compareTo,
            'costCenter' => $dates['costCenter'],
        ]);

        $statement = (new ProfitAndLossStatementBuilder)->build(
            $rows,
            $dates['fromDate'],
            $dates['toDate'],
            $compareTo,
            $dates['costCenter']
        );

        $fyRange = ActiveFiscalYear::range($dates['toDate'] ?: null);

        return [
            'view' => 'reports.profit_and_loss_statement',
            'title' => $title,
            'subtitle' => $this->periodSubtitle($dates['fromDate'], $dates['toDate']),
            'statement' => $statement,
            'compareLabel' => $compareTo === 'Period Y-1' ? 'Period Y-1' : 'Accumulated',
            'fiscalYear' => [
                'from' => $fyRange['fiscal_year_from'],
                'to' => $fyRange['fiscal_year_to'],
                'from_display' => $this->formatReportDate($fyRange['fiscal_year_from']),
                'to_display' => $this->formatReportDate($fyRange['fiscal_year_to']),
                'label' => $fyRange['label'],
                'active' => true,
            ],
            'periodDisplay' => $this->formatReportPeriod($dates['fromDate'], $dates['toDate']),
            'companyHeader' => CompanyReportHeader::forReports(),
        ];
    }

    private function chartOfAccounts(Request $request, string $title): array
    {
        $data = DB::table('chart_master')
            ->select('account_code as code', 'account_name as name', 'account_type as type')
            ->orderBy('account_code')
            ->get();
        return $this->pack($title, ['code' => 'Code', 'name' => 'Name', 'type' => 'Type'], $data, $request);
    }

    private function glTransactions(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $data = $this->glTrans->search([
            'selectedAccount' => $request->input('account', $request->input('selectedAccount')),
            'fromDate' => $dates['fromDate'],
            'toDate' => $dates['toDate'],
            'costCenter' => $dates['costCenter'],
            'memo' => $request->input('memo'),
        ]);

        return $this->pack($title, [
            'reference' => 'Reference',
            'date' => 'Date',
            'account' => 'Account',
            'debit' => 'Debit',
            'credit' => 'Credit',
            'memo' => 'Memo',
        ], $this->normalizeRows($data), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function journalEntries(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $headers = $this->journal->search([
            'reference' => $request->input('reference'),
            'fromDate' => $dates['fromDate'],
            'toDate' => $dates['toDate'],
            'type' => $request->input('type'),
        ]);

        $grouped = [];
        foreach ($headers as $header) {
            $details = $this->glTrans->findForTransaction([
                'trans_type' => (int) $header->trans_type,
                'trans_no' => (int) $header->trans_no,
                'reference' => $header->reference,
            ]);

            $totalDebit = 0.0;
            $totalCredit = 0.0;
            foreach ($details as $d) {
                $totalDebit += (float) ($d->debit ?? 0);
                $totalCredit += (float) ($d->credit ?? 0);
            }

            $grouped[] = [
                'header' => $header,
                'details' => $details,
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
            ];
        }

        return [
            'view' => 'reports.journal_entries_grouped',
            'title' => $title,
            'subtitle' => $this->periodSubtitle($dates['fromDate'], $dates['toDate']),
            'grouped' => $grouped,
            'companyHeader' => CompanyReportHeader::forReports(),
        ];
    }

    private function taxReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $data = $this->taxInquiry->search([
            'fromDate' => $dates['fromDate'],
            'toDate' => $dates['toDate'],
        ]);

        return $this->pack($title, [
            'type' => 'Type',
            'description' => 'Description',
            'amount' => 'Amount',
            'outputsInputs' => 'Outputs/Inputs',
        ], $this->normalizeRows($data), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function costCenterSummary(Request $request, string $title): array
    {
        $fromId = (int) $request->input('fromCostCenter');
        $toId = (int) $request->input('toCostCenter');
        $showBalance = strtolower((string) $request->input('showBalance', 'no')) === 'yes';

        if ($fromId <= 0 || $toId <= 0) {
            return $this->pack($title, ['message' => 'From and To cost center are required'], collect(), $request);
        }

        if ($fromId > $toId) {
            [$fromId, $toId] = [$toId, $fromId];
        }

        $data = $this->costCenters->search([
            'fromId' => $fromId,
            'toId' => $toId,
        ])->values();

        $fyRange = ActiveFiscalYear::range(null);
        $ytdFrom = $fyRange['fiscal_year_from'];
        $ytdTo = now()->toDateString();

        $headers = [
            'reference' => 'Reference',
            'name' => 'Name',
            'type' => 'Type',
            'start_date' => 'Date',
            'date_required_by' => 'Due Date',
            'closed' => 'Closed',
        ];

        if ($showBalance) {
            $headers['balance'] = 'YTD Balance';
        }

        $rows = $data->map(function ($dim) use ($showBalance, $ytdFrom, $ytdTo) {
            $row = [
                'reference' => $dim->reference,
                'name' => $dim->name,
                'type' => (int) $dim->type === 2 ? 'Cost Center 2' : 'Cost Center 1',
                'start_date' => $dim->start_date,
                'date_required_by' => $dim->date_required_by,
                'closed' => $dim->closed ? 'Yes' : 'No',
            ];

            if ($showBalance) {
                $row['balance'] = CostCenterGlBalance::sum((int) $dim->id, $ytdFrom, $ytdTo);
            }

            return $row;
        });

        $fromDim = $data->firstWhere('id', $fromId);
        $toDim = $data->firstWhere('id', $toId);
        $subtitle = trim(sprintf(
            '%s to %s',
            $fromDim ? "{$fromDim->reference} {$fromDim->name}" : (string) $fromId,
            $toDim ? "{$toDim->reference} {$toDim->name}" : (string) $toId
        ));

        return $this->pack($title, $headers, $this->normalizeRows($rows), $request, $subtitle);
    }

    private function bankStatement(Request $request, string $title, bool $reconcileOnly = false): array
    {
        $query = DB::table('bank_trans as bt')
            ->leftJoin('bank_accounts as ba', 'bt.bank_act', '=', 'ba.id')
            ->leftJoin('trans_types as tt', 'bt.type', '=', 'tt.trans_type')
            ->select(
                'bt.ref as reference',
                'bt.trans_date as date',
                'ba.bank_account_name as bank',
                'bt.amount',
                DB::raw('COALESCE(tt.description, CAST(bt.type AS CHAR)) as type'),
                'bt.reconciled'
            )
            ->orderByDesc('bt.trans_date');

        if ($request->filled('startDate')) {
            $query->where('bt.trans_date', '>=', $request->input('startDate'));
        }
        if ($request->filled('endDate')) {
            $query->where('bt.trans_date', '<=', $request->input('endDate'));
        }
        if ($request->filled('bankAccount') && $request->input('bankAccount') !== 'All') {
            $query->where('bt.bank_act', $request->input('bankAccount'));
        }
        if ($reconcileOnly) {
            $query->whereNotNull('bt.reconciled');
        }

        $headers = [
            'date' => 'Date',
            'reference' => 'Reference',
            'bank' => 'Bank',
            'amount' => 'Amount',
            'type' => 'Type',
        ];
        if ($reconcileOnly) {
            $headers['reconciled'] = 'Reconciled';
        }

        return $this->pack($title, $headers, $query->get(), $request);
    }

    private function auditTrailReport(Request $request, string $title): array
    {
        $query = DB::table('audit_trail as a')
            ->leftJoin('trans_types as tt', 'a.type', '=', 'tt.trans_type')
            ->select(
                'a.stamp as date',
                DB::raw('COALESCE(tt.description, CAST(a.type AS CHAR)) as type'),
                'a.trans_no',
                'a.description',
                'a.gl_seq',
                'a.gl_date'
            )
            ->orderByDesc('a.stamp');

        if ($request->filled('startDate')) {
            $query->whereDate('a.stamp', '>=', $request->input('startDate'));
        }
        if ($request->filled('endDate')) {
            $query->whereDate('a.stamp', '<=', $request->input('endDate'));
        }
        if ($request->filled('type')) {
            $query->where('a.type', $request->input('type'));
        }

        return $this->pack($title, [
            'date' => 'Stamp',
            'type' => 'Type',
            'trans_no' => 'Trans #',
            'description' => 'Description',
            'gl_seq' => 'GL Seq',
            'gl_date' => 'GL Date',
        ], $query->limit(1000)->get(), $request);
    }

    private function annualExpenseBreakdown(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $year = (int) ($request->input('year') ?: date('Y'));
        $from = $dates['fromDate'] !== '' ? $dates['fromDate'] : "{$year}-01-01";
        $to = $dates['toDate'] !== '' ? $dates['toDate'] : "{$year}-12-31";

        $debitExpr = \App\Support\GlBalanceQuery::rangeDebitSumExpr('gt', $from, $to);
        $creditExpr = \App\Support\GlBalanceQuery::rangeCreditSumExpr('gt', $from, $to);

        $query = DB::table('chart_master as cm')
            ->join('chart_types as ct', 'cm.account_type', '=', 'ct.id')
            ->join('chart_class as cc', 'ct.class_id', '=', 'cc.cid')
            ->leftJoin('gl_trans as gt', function ($join) {
                $join->on(DB::raw('TRIM(cm.account_code)'), '=', DB::raw('TRIM(gt.account)'));
            })
            ->where('ct.class_id', '4');

        \App\Support\GlBalanceQuery::applyCostCenter($query, $dates['costCenter'], 'gt');

        $data = $query->groupBy('cm.account_code', 'cm.account_name', 'cm.account_type', 'ct.name', 'cc.class_name')
            ->select(
                'cm.account_code as code',
                'cm.account_name as account',
                'cm.account_type',
                'ct.name as type',
                'cc.class_name as class',
                DB::raw("{$debitExpr} as period_debit"),
                DB::raw("{$creditExpr} as period_credit")
            )
            ->orderBy('cm.account_code')
            ->get()
            ->map(function ($row) {
                $amount = \App\Support\TrialAccountBalance::signedBalance(
                    (float) $row->period_debit,
                    (float) $row->period_credit,
                    (int) $row->account_type
                );
                if (abs($amount) < 0.001) {
                    return null;
                }
                $row->amount = round($amount, 2);
                unset($row->period_debit, $row->period_credit, $row->account_type);

                return $row;
            })
            ->filter()
            ->values();

        return $this->pack($title, [
            'code' => 'Code',
            'account' => 'Account',
            'type' => 'Type',
            'class' => 'Class',
            'amount' => 'Amount',
        ], $data, $request, $this->periodSubtitle($from, $to));
    }

    private function priceListing(Request $request, string $title): array
    {
        if (!Schema::hasTable('sales_prices')) {
            return $this->pack($title, ['message' => 'Info'], collect([['message' => 'Price list table not available']]), $request);
        }

        $query = DB::table('sales_prices as sp')
            ->leftJoin('stock_master as sm', 'sp.stock_id', '=', 'sm.stock_id')
            ->select(
                'sp.stock_id',
                'sm.description',
                'sp.sales_type_id',
                'sp.curr_abrev',
                'sp.price'
            )
            ->orderBy('sp.stock_id');

        return $this->pack($title, [
            'stock_id' => 'Item',
            'description' => 'Description',
            'sales_type_id' => 'Price List',
            'curr_abrev' => 'Currency',
            'price' => 'Price',
        ], $query->limit(2000)->get(), $request);
    }

    private function orderStatusListing(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        if (!Schema::hasTable('sales_orders')) {
            return $this->pack($title, ['message' => 'Info'], collect([]), $request);
        }

        $query = DB::table('sales_orders as so')
            ->leftJoin('debtors_master as d', 'so.debtor_no', '=', 'd.debtor_no')
            ->select(
                'so.order_no',
                'so.ord_date as date',
                DB::raw('COALESCE(d.name, "") as customer'),
                'so.reference',
                'so.total',
                'so.delivery_date'
            )
            ->orderByDesc('so.ord_date');

        if ($dates['fromDate']) {
            $query->where('so.ord_date', '>=', $dates['fromDate']);
        }
        if ($dates['toDate']) {
            $query->where('so.ord_date', '<=', $dates['toDate']);
        }

        return $this->pack($title, [
            'order_no' => 'Order #',
            'date' => 'Date',
            'customer' => 'Customer',
            'reference' => 'Reference',
            'total' => 'Total',
            'delivery_date' => 'Delivery',
        ], $query->limit(2000)->get(), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function salesmanListing(Request $request, string $title): array
    {
        if (!Schema::hasTable('salesman')) {
            return $this->pack($title, ['message' => 'Info'], collect([]), $request);
        }

        $data = DB::table('salesman')
            ->select('salesman_code', 'salesman_name', 'provision', 'break_pt', 'provision2')
            ->orderBy('salesman_name')
            ->get();

        return $this->pack($title, [
            'salesman_code' => 'Code',
            'salesman_name' => 'Name',
            'provision' => 'Provision %',
            'break_pt' => 'Break Pt',
            'provision2' => 'Provision 2 %',
        ], $data, $request);
    }

    private function printStatements(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $query = DB::table('debtor_trans as t')
            ->join('debtors_master as d', 't.debtor_no', '=', 'd.debtor_no')
            ->select(
                'd.debtor_no',
                'd.name as customer',
                DB::raw('SUM(IFNULL(t.ov_amount + t.ov_gst + t.ov_freight + t.ov_freight_tax + t.ov_discount - t.alloc, 0)) as balance')
            )
            ->groupBy('d.debtor_no', 'd.name')
            ->havingRaw('ABS(SUM(IFNULL(t.ov_amount + t.ov_gst + t.ov_freight + t.ov_freight_tax + t.ov_discount - t.alloc, 0))) > 0.001')
            ->orderBy('d.name');

        if ($dates['toDate']) {
            $query->where('t.tran_date', '<=', $dates['toDate']);
        }

        return $this->pack($title, [
            'debtor_no' => 'Customer #',
            'customer' => 'Customer',
            'balance' => 'Balance',
        ], $query->get(), $request, 'As at: ' . ($dates['toDate'] ?: now()->toDateString()));
    }

    private function printSalesQuotations(Request $request, string $title): array
    {
        return $this->debtorTransReport($request, $title, [32], 'Sales Quotations');
    }

    private function supplierTrialBalances(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $suppliers = DB::table('suppliers')->select('supplier_id', 'supp_name')->orderBy('supplier_id')->get();

        $rows = $suppliers->map(function ($supplier) use ($dates) {
            $opening = DB::table('supp_trans')
                ->where('supplier_id', $supplier->supplier_id)
                ->where('trans_date', '<', $dates['fromDate'] ?: '1900-01-01')
                ->sum(DB::raw('ov_amount + ov_gst - alloc'));

            $debits = DB::table('supp_trans')
                ->where('supplier_id', $supplier->supplier_id)
                ->whereBetween('trans_date', [$dates['fromDate'] ?: '1900-01-01', $dates['toDate'] ?: '2999-12-31'])
                ->where('ov_amount', '>', 0)
                ->sum('ov_amount');

            $credits = DB::table('supp_trans')
                ->where('supplier_id', $supplier->supplier_id)
                ->whereBetween('trans_date', [$dates['fromDate'] ?: '1900-01-01', $dates['toDate'] ?: '2999-12-31'])
                ->where('ov_amount', '<', 0)
                ->sum(DB::raw('ABS(ov_amount)'));

            $closing = (float) $opening + (float) $debits - (float) $credits;
            if (abs($closing) < 0.001 && abs($opening) < 0.001) {
                return null;
            }

            return (object) [
                'supplier_id' => $supplier->supplier_id,
                'name' => $supplier->supp_name,
                'opening_balance' => round((float) $opening, 2),
                'debits' => round((float) $debits, 2),
                'credits' => round((float) $credits, 2),
                'closing_balance' => round($closing, 2),
            ];
        })->filter()->values();

        return $this->pack($title, [
            'supplier_id' => 'Supplier #',
            'name' => 'Name',
            'opening_balance' => 'Opening',
            'debits' => 'Debits',
            'credits' => 'Credits',
            'closing_balance' => 'Closing',
        ], $rows, $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function outstandingGrnsReport(Request $request, string $title): array
    {
        if (!Schema::hasTable('grn_batch')) {
            return $this->pack($title, ['message' => 'Info'], collect([]), $request);
        }

        $dates = $this->reportDates($request);
        $query = DB::table('grn_batch as g')
            ->leftJoin('suppliers as s', 'g.supplier_id', '=', 's.supplier_id')
            ->select(
                'g.id',
                'g.delivery_date as date',
                DB::raw('COALESCE(s.supp_name, "") as supplier'),
                'g.reference',
                'g.qty_recd',
                'g.qty_inv'
            )
            ->whereRaw('IFNULL(g.qty_recd, 0) > IFNULL(g.qty_inv, 0)')
            ->orderByDesc('g.delivery_date');

        if ($dates['fromDate']) {
            $query->where('g.delivery_date', '>=', $dates['fromDate']);
        }
        if ($dates['toDate']) {
            $query->where('g.delivery_date', '<=', $dates['toDate']);
        }

        return $this->pack($title, [
            'id' => 'GRN #',
            'date' => 'Date',
            'supplier' => 'Supplier',
            'reference' => 'Reference',
            'qty_recd' => 'Qty Received',
            'qty_inv' => 'Qty Invoiced',
        ], $query->limit(2000)->get(), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function supplierDetailListing(Request $request, string $title): array
    {
        $data = DB::table('suppliers')
            ->select('supplier_id', 'supp_name as name', 'curr_code', 'tax_group_id', 'website')
            ->orderBy('supp_name')
            ->get();

        return $this->pack($title, [
            'supplier_id' => 'Supplier #',
            'name' => 'Name',
            'curr_code' => 'Currency',
            'tax_group_id' => 'Tax Group',
            'website' => 'Website',
        ], $data, $request);
    }

    private function inventoryPlanning(Request $request, string $title): array
    {
        if (!Schema::hasTable('loc_stock')) {
            return $this->inventoryValuation($request, $title);
        }

        $data = DB::table('stock_master as sm')
            ->leftJoinSub(
                DB::table('loc_stock')->select('stock_id', DB::raw('SUM(quantity) as qty'), DB::raw('SUM(reorder_level) as reorder_level'))->groupBy('stock_id'),
                'ls',
                'sm.stock_id',
                '=',
                'ls.stock_id'
            )
            ->select(
                'sm.stock_id',
                'sm.description',
                DB::raw('COALESCE(ls.qty, 0) as on_hand'),
                DB::raw('COALESCE(ls.reorder_level, 0) as reorder_level')
            )
            ->orderBy('sm.stock_id')
            ->get();

        return $this->pack($title, [
            'stock_id' => 'Item',
            'description' => 'Description',
            'on_hand' => 'On Hand',
            'reorder_level' => 'Reorder Level',
        ], $data, $request);
    }

    private function stockCheckSheets(Request $request, string $title): array
    {
        if (!Schema::hasTable('loc_stock')) {
            return $this->pack($title, ['message' => 'Info'], collect([]), $request);
        }

        $query = DB::table('loc_stock as ls')
            ->join('stock_master as sm', 'ls.stock_id', '=', 'sm.stock_id')
            ->select('ls.loc_code', 'ls.stock_id', 'sm.description', 'ls.quantity')
            ->orderBy('ls.loc_code')
            ->orderBy('ls.stock_id');

        if ($request->filled('location') && $request->input('location') !== 'All') {
            $query->where('ls.loc_code', $request->input('location'));
        }

        return $this->pack($title, [
            'loc_code' => 'Location',
            'stock_id' => 'Item',
            'description' => 'Description',
            'quantity' => 'Quantity',
        ], $query->get(), $request);
    }

    private function inventorySalesReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $query = DB::table('stock_moves as m')
            ->join('stock_master as sm', 'm.stock_id', '=', 'sm.stock_id')
            ->select('m.tran_date as date', 'm.stock_id', 'sm.description', 'm.loc_code', 'm.qty', 'm.price')
            ->where('m.qty', '<', 0)
            ->orderByDesc('m.tran_date');

        if ($dates['fromDate']) {
            $query->where('m.tran_date', '>=', $dates['fromDate']);
        }
        if ($dates['toDate']) {
            $query->where('m.tran_date', '<=', $dates['toDate']);
        }

        return $this->pack($title, [
            'date' => 'Date',
            'stock_id' => 'Item',
            'description' => 'Description',
            'loc_code' => 'Location',
            'qty' => 'Qty',
            'price' => 'Price',
        ], $query->limit(2000)->get(), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function grnValuationReport(Request $request, string $title): array
    {
        if (!Schema::hasTable('grn_items')) {
            return $this->outstandingGrnsReport($request, $title);
        }

        $dates = $this->reportDates($request);
        $query = DB::table('grn_items as gi')
            ->join('grn_batch as gb', 'gi.grn_batch_id', '=', 'gb.id')
            ->join('stock_master as sm', 'gi.item_code', '=', 'sm.stock_id')
            ->leftJoin('purch_order_details as pod', 'gi.po_detail_item', '=', 'pod.po_detail_item')
            ->select(
                'gb.delivery_date as date',
                'gi.item_code as stock_id',
                'sm.description',
                'gi.qty_recd',
                'pod.unit_price',
                DB::raw('gi.qty_recd * pod.unit_price as value')
            )
            ->orderByDesc('gb.delivery_date');

        if ($dates['fromDate']) {
            $query->where('gb.delivery_date', '>=', $dates['fromDate']);
        }
        if ($dates['toDate']) {
            $query->where('gb.delivery_date', '<=', $dates['toDate']);
        }

        return $this->pack($title, [
            'date' => 'Date',
            'stock_id' => 'Item',
            'description' => 'Description',
            'qty_recd' => 'Qty',
            'unit_price' => 'Unit Price',
            'value' => 'Value',
        ], $query->limit(2000)->get(), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function inventoryPurchasingReport(Request $request, string $title): array
    {
        return $this->purchasesModuleDataPack($request, $title);
    }

    private function inventoryMovementReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);

        return $this->pack($title, [
            'date' => 'Date',
            'type_name' => 'Type',
            'reference' => 'Reference',
            'stock_id' => 'Item',
            'description' => 'Description',
            'loc_code' => 'Location',
            'qty' => 'Quantity',
            'price' => 'Unit Cost',
        ], $this->inventoryModuleData($request), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function costedInventoryMovementReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        $query = DB::table('stock_moves as m')
            ->join('stock_master as sm', 'm.stock_id', '=', 'sm.stock_id')
            ->select(
                'm.tran_date as date',
                'm.stock_id',
                'sm.description',
                'm.loc_code',
                'm.qty',
                'm.price',
                'sm.material_cost as standard_cost',
                DB::raw('m.qty * sm.material_cost as cost_value')
            )
            ->orderByDesc('m.tran_date');

        $this->applyInventoryStockFilters($query, $request, 'm', true);

        if ($dates['fromDate']) {
            $query->where('m.tran_date', '>=', $dates['fromDate']);
        }
        if ($dates['toDate']) {
            $query->where('m.tran_date', '<=', $dates['toDate']);
        }

        return $this->pack($title, [
            'date' => 'Date',
            'stock_id' => 'Item',
            'description' => 'Description',
            'loc_code' => 'Location',
            'qty' => 'Qty',
            'price' => 'Price',
            'standard_cost' => 'Std Cost',
            'cost_value' => 'Cost Value',
        ], $query->limit(2000)->get(), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function itemSalesSummaryReport(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);
        if (!Schema::hasTable('debtor_trans_details')) {
            return $this->pack($title, ['message' => 'Info'], collect([]), $request);
        }

        $query = DB::table('debtor_trans_details as dtd')
            ->join('stock_master as sm', 'dtd.stock_id', '=', 'sm.stock_id')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dtd.debtor_trans_type', '=', 'dt.trans_type')
                    ->on('dtd.debtor_trans_no', '=', 'dt.trans_no');
            })
            ->select(
                'dtd.stock_id',
                'sm.description',
                DB::raw('SUM(dtd.quantity) as qty_sold'),
                DB::raw('SUM(dtd.unit_price * dtd.quantity) as sales_value')
            )
            ->groupBy('dtd.stock_id', 'sm.description')
            ->orderBy('dtd.stock_id');

        if ($dates['fromDate']) {
            $query->where('dt.tran_date', '>=', $dates['fromDate']);
        }
        if ($dates['toDate']) {
            $query->where('dt.tran_date', '<=', $dates['toDate']);
        }

        return $this->pack($title, [
            'stock_id' => 'Item',
            'description' => 'Description',
            'qty_sold' => 'Qty Sold',
            'sales_value' => 'Sales Value',
        ], $query->get(), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function inventoryPurchasingTransactionBased(Request $request, string $title): array
    {
        return $this->purchasesModuleDataPack($request, $title);
    }

    private function purchasesModuleDataPack(Request $request, string $title): array
    {
        $dates = $this->reportDates($request);

        return $this->pack($title, [
            'date' => 'Date',
            'reference' => 'Reference',
            'supplier' => 'Supplier',
            'amount' => 'Amount',
            'type' => 'Type',
        ], $this->purchasesModuleData($dates['fromDate'], $dates['toDate']), $request, $this->periodSubtitle($dates['fromDate'], $dates['toDate']));
    }

    private function billOfMaterialListing(Request $request, string $title): array
    {
        if (!Schema::hasTable('bom')) {
            return $this->pack($title, ['message' => 'Info'], collect([]), $request);
        }

        $data = DB::table('bom as b')
            ->leftJoin('stock_master as parent', 'b.parent', '=', 'parent.stock_id')
            ->leftJoin('stock_master as component', 'b.component', '=', 'component.stock_id')
            ->select(
                'b.parent',
                DB::raw('COALESCE(parent.description, "") as parent_name'),
                'b.component',
                DB::raw('COALESCE(component.description, "") as component_name'),
                'b.quantity',
                'b.loc_code'
            )
            ->orderBy('b.parent')
            ->orderBy('b.component')
            ->get();

        return $this->pack($title, [
            'parent' => 'Parent Item',
            'parent_name' => 'Parent Description',
            'component' => 'Component',
            'component_name' => 'Component Description',
            'quantity' => 'Quantity',
            'loc_code' => 'Location',
        ], $data, $request);
    }

    private function workOrderListing(Request $request, string $title): array
    {
        return $this->pack($title, [
            'id' => 'Workorder #',
            'stock_id' => 'Item',
            'loc_code' => 'Location',
            'required_by' => 'Required By',
            'quantity' => 'Quantity',
            'released_date' => 'Released',
        ], $this->manufacturingModuleData(), $request);
    }

    private function printWorkOrders(Request $request, string $title): array
    {
        return $this->workOrderListing($request, 'Work Orders');
    }

    private function fixedAssetsValuation(Request $request, string $title): array
    {
        $faFlag = 4;
        $asAt = $request->input('endDate', $request->input('asAtDate', now()->toDateString()));
        $classFilter = $request->input('fixedAssetsClass', $request->input('faClass'));
        $locFilter = $request->input('fixedAssetsLocation', $request->input('location'));

        $query = DB::table('stock_master as sm')
            ->leftJoin('stock_fa_class as fc', 'sm.fa_class_id', '=', 'fc.fa_class_id');

        $hasDep = Schema::hasTable('fa_depreciation_lines');
        if ($hasDep) {
            $depSub = DB::table('fa_depreciation_lines')
                ->select('stock_id', DB::raw('SUM(amount) as total_dep'))
                ->groupBy('stock_id');
            $query->leftJoinSub($depSub, 'dep', 'sm.stock_id', '=', 'dep.stock_id');
        }
        $depExpr = $hasDep ? 'COALESCE(dep.total_dep, 0)' : '0';

        $query
            ->where('sm.mb_flag', $faFlag)
            ->where('sm.inactive', 0)
            ->select(
                'sm.stock_id as code',
                'sm.description as name',
                DB::raw('COALESCE(fc.description, "") as class'),
                DB::raw('COALESCE(sm.purchase_cost, sm.material_cost, 0) as cost'),
                DB::raw("{$depExpr} as depreciation"),
                DB::raw("GREATEST(COALESCE(sm.purchase_cost, sm.material_cost, 0) - {$depExpr}, 0) as book_value")
            )
            ->orderBy('sm.stock_id');

        if ($classFilter && $classFilter !== 'NoFilter') {
            $query->where('sm.fa_class_id', $classFilter);
        }

        if ($locFilter && $locFilter !== 'NoFilter' && Schema::hasTable('stock_moves')) {
            $movesSub = DB::table('stock_moves')
                ->select('stock_id', DB::raw('SUM(qty) as qty'))
                ->where('loc_code', $locFilter);
            if ($asAt !== '') {
                $movesSub->where('tran_date', '<=', $asAt);
            }
            $movesSub->groupBy('stock_id');

            $query->joinSub($movesSub, 'mv', 'sm.stock_id', '=', 'mv.stock_id')
                ->where('mv.qty', '>', 0);
        }

        return $this->pack($title, [
            'code' => 'Asset ID',
            'name' => 'Description',
            'class' => 'Class',
            'cost' => 'Cost',
            'depreciation' => 'Depreciation',
            'book_value' => 'Book Value',
        ], $query->get(), $request, 'As at: ' . $asAt);
    }

    private function inventoryValuation(Request $request, string $title): array
    {
        $asAt = (string) ($request->input('endDate', $request->input('toDate', '')));
        $location = $request->input('location');
        $category = $request->input('itemCategory');
        $useLocation = $location && $location !== 'NoFilter';

        $movesSub = DB::table('stock_moves')
            ->select('stock_id', DB::raw('SUM(qty) as qty'));

        if ($useLocation) {
            $movesSub->where('loc_code', $location);
        }
        if ($asAt !== '') {
            $movesSub->where('tran_date', '<=', $asAt);
        }

        $movesSub->groupBy('stock_id');

        $query = DB::table('stock_master as sm')
            ->joinSub($movesSub, 'mv', 'sm.stock_id', '=', 'mv.stock_id')
            ->select(
                'sm.stock_id as code',
                'sm.description as name',
                'mv.qty',
                'sm.material_cost as unit_cost',
                DB::raw('mv.qty * sm.material_cost as value')
            )
            ->orderBy('sm.stock_id');

        if ($category && $category !== 'NoFilter') {
            $query->where('sm.category_id', $category);
        }

        return $this->pack($title, [
            'code' => 'Item',
            'name' => 'Description',
            'qty' => 'Qty',
            'unit_cost' => 'Unit Cost',
            'value' => 'Value',
        ], $query->get(), $request, $asAt !== '' ? 'As at: ' . $asAt : null);
    }

    private function debtorTransReport(Request $request, string $title, array $types, string $label): array
    {
        $query = DB::table('debtor_trans as t')
            ->join('debtors_master as d', 't.debtor_no', '=', 'd.debtor_no')
            ->whereIn('t.trans_type', $types)
            ->select(
                't.reference',
                't.tran_date as date',
                'd.name as customer',
                't.ov_amount as amount'
            )
            ->orderByDesc('t.tran_date');

        if ($request->filled('startDate')) {
            $query->where('t.tran_date', '>=', $request->input('startDate'));
        }
        if ($request->filled('endDate')) {
            $query->where('t.tran_date', '<=', $request->input('endDate'));
        }

        return $this->pack($label, [
            'date' => 'Date',
            'reference' => 'Reference',
            'customer' => 'Customer',
            'amount' => 'Amount',
        ], $query->limit(500)->get(), $request);
    }

    private function printPurchaseOrders(Request $request, string $title): array
    {
        $query = DB::table('purch_orders as po')
            ->join('suppliers as s', 'po.supplier_id', '=', 's.supplier_id')
            ->select(
                'po.reference',
                'po.ord_date as date',
                's.supp_name as supplier',
                'po.total as amount',
                'po.order_no'
            )
            ->orderByDesc('po.ord_date');

        if ($request->filled('startDate')) {
            $query->where('po.ord_date', '>=', $request->input('startDate'));
        }
        if ($request->filled('endDate')) {
            $query->where('po.ord_date', '<=', $request->input('endDate'));
        }
        if ($request->filled('supplier')) {
            $query->where('po.supplier_id', $request->input('supplier'));
        }

        return $this->pack('Purchase Orders', [
            'date' => 'Date',
            'reference' => 'Reference',
            'supplier' => 'Supplier',
            'amount' => 'Amount',
            'order_no' => 'Order #',
        ], $query->limit(500)->get(), $request);
    }

    private function suppTransReport(Request $request, string $title, array $types, string $label): array
    {
        $query = DB::table('supp_trans as t')
            ->join('suppliers as s', 't.supplier_id', '=', 's.supplier_id')
            ->whereIn('t.trans_type', $types)
            ->select(
                't.reference',
                't.trans_date as date',
                's.supp_name as supplier',
                't.ov_amount as amount'
            )
            ->orderByDesc('t.trans_date');

        if ($request->filled('startDate')) {
            $query->where('t.trans_date', '>=', $request->input('startDate'));
        }
        if ($request->filled('endDate')) {
            $query->where('t.trans_date', '<=', $request->input('endDate'));
        }

        return $this->pack($label, [
            'date' => 'Date',
            'reference' => 'Reference',
            'supplier' => 'Supplier',
            'amount' => 'Amount',
        ], $query->limit(500)->get(), $request);
    }

    private function fallback(Request $request, string $title, string $reportKey): array
    {
        $module = $request->input('module');
        if (is_string($module) && $module !== '') {
            return $this->moduleSnapshot($request, $title, $module);
        }

        $data = $this->tryGenericList($reportKey, $request);
        if ($data->isNotEmpty()) {
            $first = (array) $data->first();
            $headers = [];
            foreach (array_keys($first) as $field) {
                $headers[$field] = Str::title(str_replace('_', ' ', $field));
            }
            return $this->pack($title, $headers, $data, $request);
        }

        return array_merge([
            'title' => $title,
            'subtitle' => null,
            'headers' => [],
            'rows' => [],
            'parameters' => $this->flatParams($request),
        ], [
            'companyHeader' => CompanyReportHeader::forReports(),
        ]);
    }

    private function moduleSnapshot(Request $request, string $title, string $module): array
    {
        $module = strtolower(trim($module));
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');

        return match ($module) {
            'sales' => $this->pack($title, [
                'date' => 'Date',
                'reference' => 'Reference',
                'customer' => 'Customer',
                'amount' => 'Amount',
                'type' => 'Type',
            ], $this->salesModuleData($startDate, $endDate), $request, $this->periodSubtitle($startDate, $endDate)),

            'purchases', 'purchase' => $this->pack($title, [
                'date' => 'Date',
                'reference' => 'Reference',
                'supplier' => 'Supplier',
                'amount' => 'Amount',
                'type' => 'Type',
            ], $this->purchasesModuleData($startDate, $endDate), $request, $this->periodSubtitle($startDate, $endDate)),

            'items' => $this->pack($title, [
                'stock_id' => 'Item Code',
                'description' => 'Description',
                'category' => 'Category',
                'unit_cost' => 'Unit Cost',
                'inactive' => 'Inactive',
            ], $this->itemsModuleData(), $request),

            'inventory' => $this->pack($title, [
                'date' => 'Date',
                'stock_id' => 'Item',
                'loc_code' => 'Location',
                'qty' => 'Quantity',
                'price' => 'Price',
            ], $this->inventoryModuleData($request), $request, $this->periodSubtitle($startDate, $endDate)),

            'manufacturing' => $this->pack($title, [
                'id' => 'Workorder #',
                'stock_id' => 'Item',
                'loc_code' => 'Location',
                'required_by' => 'Required By',
                'quantity' => 'Quantity',
                'released_date' => 'Released',
            ], $this->manufacturingModuleData(), $request),

            'fixed-assets', 'fixedassets' => $this->fixedAssetsValuation($request, $title),

            'cost-centers' => $this->pack($title, [
                'reference' => 'Reference',
                'name' => 'Name',
                'type' => 'Type',
                'start_date' => 'Start Date',
                'date_required_by' => 'Required By',
            ], $this->costCentersModuleData($startDate, $endDate), $request, $this->periodSubtitle($startDate, $endDate)),

            'banking' => $this->pack($title, [
                'date' => 'Date',
                'reference' => 'Reference',
                'bank' => 'Bank Account',
                'amount' => 'Amount',
                'type' => 'Type',
            ], $this->bankingModuleData($startDate, $endDate), $request, $this->periodSubtitle($startDate, $endDate)),

            'general-ledger', 'generalledger', 'gl' => $this->pack($title, [
                'tran_date' => 'Date',
                'reference' => 'Reference',
                'account' => 'Account',
                'memo_' => 'Memo',
                'amount' => 'Amount',
            ], $this->generalLedgerModuleData($startDate, $endDate), $request, $this->periodSubtitle($startDate, $endDate)),

            default => $this->pack($title, [
                'message' => 'Message',
            ], collect([['message' => 'Unknown module key: ' . $module]]), $request),
        };
    }

    private function periodSubtitle(?string $startDate, ?string $endDate): ?string
    {
        if ($startDate && $endDate) {
            return $this->formatReportPeriod($startDate, $endDate);
        }
        if ($startDate) {
            return 'From ' . $this->formatReportDate($startDate);
        }
        if ($endDate) {
            return 'Up to ' . $this->formatReportDate($endDate);
        }

        return null;
    }

    private function formatReportDate(?string $date): string
    {
        if (!$date) {
            return '';
        }

        try {
            return Carbon::parse($date)->format('d/m/Y');
        } catch (\Throwable) {
            return $date;
        }
    }

    private function formatReportPeriod(?string $startDate, ?string $endDate): ?string
    {
        if ($startDate && $endDate) {
            return $this->formatReportDate($startDate) . ' - ' . $this->formatReportDate($endDate);
        }

        return null;
    }

    /**
     * @param  Collection<int, object>  $rows
     * @return array<string, array<string, float>>
     */
    private function computePlTotals(Collection $rows): array
    {
        $income = ['period' => 0.0, 'compare' => 0.0];
        $costs = ['period' => 0.0, 'compare' => 0.0];

        foreach ($rows as $row) {
            $r = (array) $row;
            $type = (int) ($r['account_type'] ?? 0);
            $period = (float) ($r['period'] ?? 0);
            $compare = (float) ($r['compareValue'] ?? 0);

            if (ChartAccountMetadata::isProfitAndLossIncomeAccount($type)) {
                $income['period'] += $period;
                $income['compare'] += $compare;
            } elseif (ChartAccountMetadata::isProfitAndLossCostAccount($type)) {
                $costs['period'] += $period;
                $costs['compare'] += $compare;
            }
        }

        return [
            'income' => [
                'period' => round($income['period'], 2),
                'compare' => round($income['compare'], 2),
            ],
            'costs' => [
                'period' => round($costs['period'], 2),
                'compare' => round($costs['compare'], 2),
            ],
            'calculated_return' => [
                'period' => round($income['period'] - $costs['period'], 2),
                'compare' => round($income['compare'] - $costs['compare'], 2),
            ],
        ];
    }

    private function salesModuleData(?string $startDate, ?string $endDate): Collection
    {
        $query = DB::table('debtor_trans as t')
            ->leftJoin('debtors_master as d', 't.debtor_no', '=', 'd.debtor_no')
            ->leftJoin('trans_types as tt', 't.trans_type', '=', 'tt.trans_type')
            ->select(
                't.tran_date as date',
                't.reference',
                DB::raw('COALESCE(d.name, "") as customer'),
                DB::raw('COALESCE(t.ov_amount + t.ov_gst + t.ov_freight + t.ov_freight_tax + t.ov_discount, 0) as amount'),
                DB::raw('COALESCE(tt.description, CAST(t.trans_type AS CHAR)) as type')
            )
            ->orderByDesc('t.tran_date');

        if ($startDate) {
            $query->where('t.tran_date', '>=', $startDate);
        }
        if ($endDate) {
            $query->where('t.tran_date', '<=', $endDate);
        }

        return $query->limit(1000)->get();
    }

    private function purchasesModuleData(?string $startDate, ?string $endDate): Collection
    {
        $query = DB::table('supp_trans as t')
            ->leftJoin('suppliers as s', 't.supplier_id', '=', 's.supplier_id')
            ->leftJoin('trans_types as tt', 't.trans_type', '=', 'tt.trans_type')
            ->select(
                't.trans_date as date',
                't.reference',
                DB::raw('COALESCE(s.supp_name, "") as supplier'),
                DB::raw('COALESCE(t.ov_amount + t.ov_gst + t.ov_discount, 0) as amount'),
                DB::raw('COALESCE(tt.description, CAST(t.trans_type AS CHAR)) as type')
            )
            ->orderByDesc('t.trans_date');

        if ($startDate) {
            $query->where('t.trans_date', '>=', $startDate);
        }
        if ($endDate) {
            $query->where('t.trans_date', '<=', $endDate);
        }

        return $query->limit(1000)->get();
    }

    private function itemsModuleData(): Collection
    {
        return DB::table('stock_master as sm')
            ->select(
                'sm.stock_id',
                'sm.description',
                DB::raw('COALESCE(sm.category_id, "") as category'),
                DB::raw('COALESCE(sm.material_cost, 0) as unit_cost'),
                'sm.inactive'
            )
            ->orderBy('sm.stock_id')
            ->limit(1000)
            ->get();
    }

    private function inventoryModuleData(Request $request): Collection
    {
        $dates = $this->reportDates($request);
        $query = DB::table('stock_moves as m')
            ->leftJoin('stock_master as sm', 'm.stock_id', '=', 'sm.stock_id')
            ->select(
                'm.tran_date as date',
                'm.type',
                'm.reference',
                'm.stock_id',
                'sm.description',
                'm.loc_code',
                'm.qty',
                'sm.material_cost as price'
            )
            ->orderByDesc('m.tran_date');

        $this->applyInventoryStockFilters($query, $request, 'm', true);

        if ($dates['fromDate']) {
            $query->where('m.tran_date', '>=', $dates['fromDate']);
        }
        if ($dates['toDate']) {
            $query->where('m.tran_date', '<=', $dates['toDate']);
        }

        return $query->limit(2000)->get()->map(function ($row) {
            $typeNames = [
                0 => 'Journal Entry',
                1 => 'Bank Payment',
                2 => 'Bank Deposit',
                10 => 'Sales Invoice',
                11 => 'Credit Note',
                12 => 'Customer Payment',
                13 => 'Delivery',
                16 => 'Location Transfer',
                17 => 'Inventory Adjustment',
                18 => 'Purchase Order',
                20 => 'Purchase Invoice',
                21 => 'Supplier Credit Note',
                22 => 'Supplier Payment',
                25 => 'GRN',
                26 => 'Work Order Issue',
                28 => 'Work Order Produce',
                29 => 'Work Order Costing',
            ];
            $row->type_name = $typeNames[$row->type] ?? "Type {$row->type}";
            return $row;
        });
    }

    /**
     * @param  \Illuminate\Database\Query\Builder  $query
     */
    private function applyInventoryStockFilters($query, Request $request, string $moveAlias = 'm', bool $stockMasterJoined = false): void
    {
        $location = $request->input('location');
        if ($location && $location !== 'NoFilter') {
            $query->where("{$moveAlias}.loc_code", $location);
        }

        $category = $request->input('itemCategory');
        if ($category && $category !== 'NoFilter') {
            if ($stockMasterJoined) {
                $query->where('sm.category_id', $category);
            } else {
                $query->whereIn("{$moveAlias}.stock_id", function ($sub) use ($category) {
                    $sub->select('stock_id')
                        ->from('stock_master')
                        ->where('category_id', $category);
                });
            }
        }
    }

    private function manufacturingModuleData(): Collection
    {
        return DB::table('workorders')
            ->select('id', 'stock_id', 'loc_code', 'required_by', 'quantity', 'released_date')
            ->orderByDesc('id')
            ->limit(1000)
            ->get();
    }

    private function costCentersModuleData(?string $startDate, ?string $endDate): Collection
    {
        $query = DB::table('cost_centers')
            ->select('reference', 'name', 'type', 'start_date', 'date_required_by')
            ->orderByDesc('start_date');

        if ($startDate) {
            $query->whereDate('start_date', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('start_date', '<=', $endDate);
        }

        return $query->limit(1000)->get();
    }

    private function bankingModuleData(?string $startDate, ?string $endDate): Collection
    {
        $query = DB::table('bank_trans as bt')
            ->leftJoin('bank_accounts as ba', 'bt.bank_act', '=', 'ba.id')
            ->leftJoin('trans_types as tt', 'bt.type', '=', 'tt.trans_type')
            ->select(
                'bt.trans_date as date',
                'bt.ref as reference',
                DB::raw('COALESCE(ba.bank_account_name, "") as bank'),
                'bt.amount',
                DB::raw('COALESCE(tt.description, CAST(bt.type AS CHAR)) as type')
            )
            ->orderByDesc('bt.trans_date');

        if ($startDate) {
            $query->where('bt.trans_date', '>=', $startDate);
        }
        if ($endDate) {
            $query->where('bt.trans_date', '<=', $endDate);
        }

        return $query->limit(1000)->get();
    }

    private function generalLedgerModuleData(?string $startDate, ?string $endDate): Collection
    {
        $dateCol = \App\Support\GlBalanceQuery::glEffectiveDateExpr('gt');
        $query = DB::table('gl_trans as gt')
            ->select(DB::raw("{$dateCol} as tran_date"), 'gt.reference', 'gt.account', 'gt.memo_', 'gt.amount')
            ->orderByRaw("{$dateCol} DESC");

        if ($startDate) {
            $query->whereRaw("DATE({$dateCol}) >= ?", [$startDate]);
        }
        if ($endDate) {
            $query->whereRaw("DATE({$dateCol}) <= ?", [$endDate]);
        }

        return $query->limit(1000)->get();
    }

    private function tryGenericList(string $reportKey, Request $request): Collection
    {
        if (str_contains($reportKey, 'supplier') || str_contains($reportKey, 'purchase')) {
            return DB::table('supp_trans')->orderByDesc('trans_date')->limit(100)->get();
        }
        if (str_contains($reportKey, 'inventory') || str_contains($reportKey, 'stock')) {
            return DB::table('stock_master')->orderBy('stock_id')->limit(100)->get();
        }
        if (str_contains($reportKey, 'work') || str_contains($reportKey, 'manufacturing')) {
            return DB::table('workorders')->orderByDesc('id')->limit(100)->get();
        }
        if (str_contains($reportKey, 'fixed-asset')) {
            return DB::table('stock_master')->where('mb_flag', 4)->limit(100)->get();
        }

        return collect();
    }
}
