<?php

namespace App\Support;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class GlTransHelper
{
    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    public static function insertLines(array $lines): void
    {
        if ($lines === [] || ! Schema::hasTable('gl_trans')) {
            return;
        }

        $normalized = array_map([self::class, 'normalizeLine'], $lines);

        try {
            DB::table('gl_trans')->insert($normalized);
        } catch (QueryException $e) {
            throw new \InvalidArgumentException(self::friendlyInsertError($e), previous: $e);
        }
    }

    private static function friendlyInsertError(QueryException $e): string
    {
        $message = $e->getMessage();

        if (stripos($message, 'Unknown column') !== false) {
            return 'Could not post GL lines: database table gl_trans is missing required columns. Run php artisan migrate on the server.';
        }

        if (stripos($message, 'foreign key constraint') !== false) {
            return 'Could not post GL lines: one or more account codes are not valid in Chart of Accounts.';
        }

        if (stripos($message, "doesn't exist") !== false && stripos($message, 'gl_trans') !== false) {
            return 'Could not post GL lines: gl_trans table is missing. Run php artisan migrate on the server.';
        }

        return 'Could not post GL lines to the general ledger. Verify account codes exist in Chart of Accounts.';
    }

    public static function alreadyPosted(int $transType, int $typeNo, ?string $account = null): bool
    {
        if (! Schema::hasTable('gl_trans')) {
            return false;
        }

        $query = self::postedQuery($transType, $typeNo);

        if ($account !== null && Schema::hasColumn('gl_trans', 'account')) {
            $query->where('account', $account);
        }

        return $query->exists();
    }

    public static function deletePosted(int $transType, int $typeNo): int
    {
        if (! Schema::hasTable('gl_trans')) {
            return 0;
        }

        return self::postedQuery($transType, $typeNo)->delete();
    }

    /**
     * Delete GL lines except memos starting with any of the given prefixes (e.g. FA extension lines).
     *
     * @param  array<int, string>  $preserveMemoPrefixes
     */
    public static function deletePostedExceptMemoPrefixes(int $transType, int $typeNo, array $preserveMemoPrefixes): int
    {
        if (! Schema::hasTable('gl_trans')) {
            return 0;
        }

        $query = self::postedQuery($transType, $typeNo);
        $memoCol = self::memoColumn();
        if ($memoCol !== null && $preserveMemoPrefixes !== []) {
            $query->where(function ($q) use ($memoCol, $preserveMemoPrefixes) {
                foreach ($preserveMemoPrefixes as $prefix) {
                    $q->where(function ($inner) use ($memoCol, $prefix) {
                        $inner->where($memoCol, 'not like', $prefix.'%')
                            ->orWhereNull($memoCol);
                    });
                }
            });
        }

        return $query->delete();
    }

    public static function hasMemoPrefix(int $transType, int $typeNo, string $memoPrefix): bool
    {
        if (! Schema::hasTable('gl_trans') || $memoPrefix === '') {
            return false;
        }

        $memoCol = self::memoColumn();
        if ($memoCol === null) {
            return self::alreadyPosted($transType, $typeNo);
        }

        return self::postedQuery($transType, $typeNo)
            ->where($memoCol, 'like', $memoPrefix.'%')
            ->exists();
    }

    private static function memoColumn(): ?string
    {
        if (! Schema::hasTable('gl_trans')) {
            return null;
        }
        if (Schema::hasColumn('gl_trans', 'memo')) {
            return 'memo';
        }
        if (Schema::hasColumn('gl_trans', 'memo_')) {
            return 'memo_';
        }

        return null;
    }

    private static function postedQuery(int $transType, int $typeNo)
    {
        $query = DB::table('gl_trans')
            ->where('type', (string) $transType);

        if (Schema::hasColumn('gl_trans', 'type_no')) {
            $query->where('type_no', $typeNo);
        } else {
            $query->where('reference', 'like', '%'.$typeNo.'%');
        }

        return $query;
    }

    /**
     * Posted GL display: only positive Debit OR Credit (journal +/- is flipped at post time).
     *
     * @return array{0: float, 1: float}
     */
    public static function normalizeDebitCreditPair(float $debit, float $credit): array
    {
        if ($debit < 0) {
            $credit += abs($debit);
            $debit = 0;
        }
        if ($credit < 0) {
            $debit += abs($credit);
            $credit = 0;
        }

        return [round($debit, 2), round($credit, 2)];
    }

    /**
     * @param  array<string, mixed>  $line
     * @return array<string, mixed>
     */
    public static function normalizeLine(array $line): array
    {
        [$debit, $credit] = self::normalizeDebitCreditPair(
            (float) ($line['debit'] ?? 0),
            (float) ($line['credit'] ?? 0)
        );
        $date = $line['date'] ?? $line['tran_date'] ?? now()->toDateString();
        $transType = $line['type'] ?? $line['trans_type'] ?? 0;

        $costCenter = $line['cost_center_id'] ?? null;
        if ($costCenter === '' || $costCenter === '0' || $costCenter === 0) {
            $costCenter = null;
        }

        $row = [];

        if (Schema::hasColumn('gl_trans', 'type')) {
            $row['type'] = is_numeric($transType) ? (string) (int) $transType : (string) $transType;
        }
        if (Schema::hasColumn('gl_trans', 'reference')) {
            $row['reference'] = $line['reference'] ?? null;
        }
        if (Schema::hasColumn('gl_trans', 'date')) {
            $row['date'] = $date;
        }
        if (Schema::hasColumn('gl_trans', 'account')) {
            $account = $line['account'] ?? null;
            $row['account'] = is_string($account) ? trim($account) : $account;
        }
        if (Schema::hasColumn('gl_trans', 'cost_center_id')) {
            $row['cost_center_id'] = $costCenter;
        }

        $costCenter2 = $line['cost_center2_id'] ?? null;
        if ($costCenter2 !== null && $costCenter2 !== '' && (int) $costCenter2 > 0
            && Schema::hasColumn('gl_trans', 'cost_center2_id')) {
            $row['cost_center2_id'] = (int) $costCenter2;
        }
        if (Schema::hasColumn('gl_trans', 'debit')) {
            $row['debit'] = $debit;
        }
        if (Schema::hasColumn('gl_trans', 'credit')) {
            $row['credit'] = $credit;
        }
        $memo = $line['memo'] ?? $line['memo_'] ?? null;
        if (Schema::hasColumn('gl_trans', 'memo')) {
            $row['memo'] = $memo;
        }
        if (Schema::hasColumn('gl_trans', 'memo_')) {
            $row['memo_'] = $memo;
        }
        if (Schema::hasColumn('gl_trans', 'tran_date')) {
            $row['tran_date'] = $date;
        }
        if (Schema::hasColumn('gl_trans', 'amount')) {
            $row['amount'] = $debit > 0 ? $debit : -$credit;
        }
        if (Schema::hasColumn('gl_trans', 'type_no') && isset($line['type_no'])) {
            $row['type_no'] = (int) $line['type_no'];
        }
        if (Schema::hasColumn('gl_trans', 'person_type_id')) {
            $row['person_type_id'] = $line['person_type_id'] ?? null;
        }
        if (Schema::hasColumn('gl_trans', 'person_id')) {
            $row['person_id'] = $line['person_id'] ?? null;
        }
        if (Schema::hasColumn('gl_trans', 'created_at')) {
            $row['created_at'] = now();
        }
        if (Schema::hasColumn('gl_trans', 'updated_at')) {
            $row['updated_at'] = now();
        }

        if (! self::usesNumericId() && Schema::hasColumn('gl_trans', 'id')) {
            $row['id'] = $line['id'] ?? Str::uuid()->toString();
        }

        if (
            $row === []
            || (
                ! isset($row['account'])
                && ! isset($row['amount'])
                && ! isset($row['debit'])
                && ! isset($row['credit'])
            )
        ) {
            throw new \InvalidArgumentException(
                'Cannot post to gl_trans: table is missing required columns (account, amount or debit/credit). Run php artisan migrate.'
            );
        }

        return $row;
    }

    public static function usesNumericId(): bool
    {
        if (! Schema::hasTable('gl_trans') || ! Schema::hasColumn('gl_trans', 'id')) {
            return true;
        }

        try {
            $type = Schema::getColumnType('gl_trans', 'id');

            return in_array($type, ['bigint', 'integer', 'int'], true);
        } catch (\Throwable) {
            return true;
        }
    }
}
