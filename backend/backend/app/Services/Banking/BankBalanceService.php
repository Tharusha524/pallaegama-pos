<?php

namespace App\Services\Banking;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FrontAccounting-style bank book balance.
 *
 * book = ending_reconcile_balance + SUM(bank_trans after last_reconciled_date)
 * If never reconciled, ending_reconcile_balance is the opening balance and every
 * bank_trans row counts as a movement on top of it.
 */
class BankBalanceService
{
    public function getBalance(int $bankAccountId, ?string $asAtDate = null): float
    {
        if (! Schema::hasTable('bank_accounts')) {
            return 0;
        }

        $account = DB::table('bank_accounts')->where('id', $bankAccountId)->first();
        if (! $account) {
            return 0;
        }

        $base = (float) ($account->ending_reconcile_balance ?? 0);
        $lastReconciled = $this->reconcileDateString($account->last_reconciled_date);

        if (! Schema::hasTable('bank_trans')) {
            return round($base, 2);
        }

        $movementsQuery = DB::table('bank_trans')->where('bank_act', $bankAccountId);
        if ($lastReconciled) {
            $movementsQuery->where('trans_date', '>', $lastReconciled);
        }
        if ($asAtDate) {
            $movementsQuery->where('trans_date', '<=', $asAtDate);
        }
        $movements = (float) $movementsQuery->sum('amount');

        return round($base + $movements, 2);
    }

    public function getBalanceBeforeDate(int $bankAccountId, string $beforeDate): float
    {
        if (! Schema::hasTable('bank_accounts')) {
            return 0;
        }

        $account = DB::table('bank_accounts')->where('id', $bankAccountId)->first();
        if (! $account) {
            return 0;
        }

        $base = (float) ($account->ending_reconcile_balance ?? 0);
        $lastReconciled = $this->reconcileDateString($account->last_reconciled_date);

        if (! Schema::hasTable('bank_trans')) {
            return round($base, 2);
        }

        $movementsQuery = DB::table('bank_trans')
            ->where('bank_act', $bankAccountId)
            ->where('trans_date', '<', $beforeDate);

        if ($lastReconciled) {
            $movementsQuery->where('trans_date', '>', $lastReconciled);
        }

        $movements = (float) $movementsQuery->sum('amount');

        return round($base + $movements, 2);
    }

    public function getTotalBalance(?string $asAtDate = null): float
    {
        if (! Schema::hasTable('bank_accounts')) {
            return 0;
        }

        $total = 0;
        foreach (DB::table('bank_accounts')->where('inactive', 0)->pluck('id') as $id) {
            $total += $this->getBalance((int) $id, $asAtDate);
        }

        return round($total, 2);
    }

    public function getAllBalances(?string $asAtDate = null): array
    {
        if (! Schema::hasTable('bank_accounts')) {
            return [];
        }

        return DB::table('bank_accounts')
            ->where('inactive', 0)
            ->orderBy('bank_account_name')
            ->get()
            ->map(function ($account) use ($asAtDate) {
                $id = (int) $account->id;

                return [
                    'id' => $id,
                    'bank_account_name' => $account->bank_account_name,
                    'bank_name' => $account->bank_name,
                    'bank_account_number' => $account->bank_account_number,
                    'account_gl_code' => $account->account_gl_code,
                    'bank_curr_code' => $account->bank_curr_code,
                    'book_balance' => $this->getBalance($id, $asAtDate),
                    'ending_reconcile_balance' => (float) ($account->ending_reconcile_balance ?? 0),
                    'last_reconciled_date' => $account->last_reconciled_date,
                ];
            })
            ->all();
    }

    public function getGlBalance(string $accountGlCode, ?string $asAtDate = null): ?float
    {
        if (! Schema::hasTable('gl_trans') || ! Schema::hasColumn('gl_trans', 'account')) {
            return null;
        }

        $query = DB::table('gl_trans as gt')->where('gt.account', $accountGlCode);
        $dateCol = \App\Support\GlBalanceQuery::glEffectiveDateExpr('gt');
        if ($asAtDate) {
            $query->whereRaw("DATE({$dateCol}) <= ?", [$asAtDate]);
        }

        if (Schema::hasColumn('gl_trans', 'debit') && Schema::hasColumn('gl_trans', 'credit')) {
            $row = $query->selectRaw('COALESCE(SUM(gt.debit),0) - COALESCE(SUM(gt.credit),0) as balance')->first();

            return $row ? round((float) $row->balance, 2) : 0;
        }

        if (Schema::hasColumn('gl_trans', 'amount')) {
            return round((float) $query->sum('gt.amount'), 2);
        }

        return null;
    }

    private function reconcileDateString(mixed $value): ?string
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse($value)->format('Y-m-d');
    }

    public function isCashBankAccount(int $bankAccountId): bool
    {
        if ($bankAccountId <= 0 || ! Schema::hasTable('bank_accounts')) {
            return false;
        }

        $account = DB::table('bank_accounts as ba')
            ->leftJoin('account_types as at', 'ba.account_type', '=', 'at.id')
            ->where('ba.id', $bankAccountId)
            ->select('ba.account_type', 'at.type_name')
            ->first();

        if (! $account) {
            return false;
        }

        if ((int) ($account->account_type ?? 0) === 4) {
            return true;
        }

        return stripos((string) ($account->type_name ?? ''), 'cash') !== false;
    }

    /**
     * Outgoing payments must use Current/Chequing (or savings), not Cash in Hand.
     */
    public function assertAllowedPaymentSource(int $bankAccountId): void
    {
        // Validation bypassed: allow payments from any account, including Cash In Hand.
        return;
    }

    /**
     * Block payments/transfers that exceed the bank book balance.
     */
    public function assertSufficientBalance(
        int $bankAccountId,
        float $requiredAmount,
        string $asAtDate,
        int $transType = 0,
        int $transNo = 0,
        bool $isUpdate = false
    ): void {
        if ($requiredAmount <= 0) {
            return;
        }

        $available = $this->getBalance($bankAccountId, $asAtDate);

        if ($isUpdate && Schema::hasTable('bank_trans')) {
            $existing = DB::table('bank_trans')
                ->where('type', $transType)
                ->where('trans_no', $transNo)
                ->where('bank_act', $bankAccountId)
                ->first();
            if ($existing) {
                $available += abs((float) ($existing->amount ?? 0));
            }
        }

        if ($requiredAmount <= $available + 0.001) {
            return;
        }

        $name = DB::table('bank_accounts')->where('id', $bankAccountId)->value('bank_account_name');
        $label = $name ? (string) $name : 'bank account';

        throw new \InvalidArgumentException(sprintf(
            'Insufficient funds in %s. Available balance is %s but this transaction requires %s.',
            $label,
            number_format($available, 2, '.', ','),
            number_format($requiredAmount, 2, '.', ',')
        ));
    }
}
