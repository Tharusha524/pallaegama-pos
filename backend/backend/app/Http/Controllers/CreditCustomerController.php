<?php

namespace App\Http\Controllers;

use App\Services\Banking\BankingTransactionService;
use App\Services\Sales\CustomerCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Finance -> Credit Customers / Credit Payments (Smart Supermarket).
 *
 * Reads only. Money is posted through the ERP's existing paths:
 *  - opening balance -> BankingTransactionService::postJournal (Dr Trade Debtors
 *    tagged to the customer, Cr the chosen equity account), the same as a
 *    manual Journal Entry;
 *  - payments -> POST /sales/payments (SalesPaymentService) with allocations.
 */
class CreditCustomerController extends Controller
{
    public function __construct(
        private CustomerCreditService $credit,
        private BankingTransactionService $banking,
    ) {}

    /** Registered customers with their credit limit and what they owe. */
    public function index(): JsonResponse
    {
        $balanceExpr = $this->credit->signedBalanceExpr('t', true);

        $rows = DB::table('debtors_master as d')
            ->leftJoinSub(
                DB::table('debtor_trans as t')
                    ->whereNotIn('t.trans_type', [13])
                    ->groupBy('t.debtor_no')
                    ->selectRaw('t.debtor_no, SUM('.$balanceExpr.') as balance'),
                'b',
                'b.debtor_no',
                '=',
                'd.debtor_no'
            )
            ->whereRaw("LOWER(TRIM(d.name)) <> 'walk-in customer'")
            ->select(
                'd.debtor_no', 'd.name', 'd.mobile', 'd.credit_limit',
                DB::raw('ROUND(IFNULL(b.balance, 0), 2) as outstanding'),
                DB::raw('(SELECT MIN(cb.branch_code) FROM cust_branch cb WHERE cb.debtor_no = d.debtor_no) as branch_code')
            )
            ->orderBy('d.name')
            ->get();

        return response()->json($rows);
    }

    /** One customer's unpaid credit bills (oldest first) and balance summary. */
    public function openBills(int $debtorNo): JsonResponse
    {
        $net = $this->credit->debtorNetExpr('t');

        $bills = DB::table('debtor_trans as t')
            ->where('t.debtor_no', $debtorNo)
            ->where('t.trans_type', 10)
            ->whereRaw('('.$net.' - IFNULL(t.alloc, 0)) > 0.005')
            ->orderBy('t.tran_date')->orderBy('t.trans_no')
            ->selectRaw('t.trans_no, t.trans_type, t.reference, t.tran_date, ROUND('.$net.', 2) as total, ROUND(IFNULL(t.alloc, 0), 2) as paid, ROUND('.$net.' - IFNULL(t.alloc, 0), 2) as owing')
            ->get();

        // Opening balances (journals to Trade Debtors for this customer).
        $opening = (float) DB::table('debtor_trans')
            ->where('debtor_no', $debtorNo)->where('trans_type', 0)
            ->sum('ov_amount');

        return response()->json([
            'summary' => $this->credit->summary($debtorNo),
            'opening_balance' => round($opening, 2),
            'bills' => $bills,
        ]);
    }

    /** Set the customer's credit limit (0 = no limit, as in the ERP). */
    public function updateLimit(Request $request, int $debtorNo): JsonResponse
    {
        $data = $request->validate(['credit_limit' => 'required|numeric|min:0']);
        DB::table('debtors_master')->where('debtor_no', $debtorNo)->update(['credit_limit' => $data['credit_limit']]);

        return response()->json($this->credit->summary($debtorNo));
    }

    /**
     * Opening credit balance: what an existing credit customer already owed
     * before the system. Posted as a normal ERP journal entry.
     */
    public function openingBalance(Request $request, int $debtorNo): JsonResponse
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'credit_account' => 'required|string|exists:chart_master,account_code',
            'tran_date' => 'required|date',
            'memo' => 'nullable|string|max:200',
        ]);

        $name = DB::table('debtors_master')->where('debtor_no', $debtorNo)->value('name');
        if (! $name || strcasecmp(trim($name), 'Walk-in Customer') === 0) {
            return response()->json(['message' => 'Select a registered customer.'], 422);
        }

        $receivable = DB::table('sys_prefs')->where('name', 'receivableAccount')->value('value');
        if (! $receivable) {
            return response()->json(['message' => 'Set the receivable (Trade Debtors) account in System Preferences first.'], 422);
        }
        if ((string) $data['credit_account'] === (string) $receivable) {
            return response()->json(['message' => 'The credit account must be different from Trade Debtors.'], 422);
        }

        $amount = round((float) $data['amount'], 2);
        $memo = ($data['memo'] ?? '') ?: 'Opening credit balance - '.$name;

        try {
            $result = $this->banking->postJournal([
                'tran_date' => $data['tran_date'],
                'memo' => $memo,
                'lines' => [
                    ['account_code' => $receivable, 'debit' => $amount, 'credit' => 0, 'memo' => $memo, 'person_type_id' => 2, 'person_id' => $debtorNo],
                    ['account_code' => $data['credit_account'], 'debit' => 0, 'credit' => $amount, 'memo' => $memo],
                ],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result, 201);
    }
}
