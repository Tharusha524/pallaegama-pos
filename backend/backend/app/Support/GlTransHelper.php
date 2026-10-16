<?php

namespace App\Support;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class GlTransHelper
{
    // Schema::hasColumn() runs an information_schema query on every call; a sale
    // posts many GL lines, so the gl_trans structure is looked up once per request.
    private static ?bool $tableExistsCache = null;

    /** @var array<string, true>|null */
    private static ?array $columnsCache = null;

    private static ?bool $numericIdCache = null;

    private static function hasTable(): bool
    {
        return self::$tableExistsCache ??= Schema::hasTable('gl_trans');
    }

    private static function hasColumn(string $column): bool
    {
        if (self::$columnsCache === null) {
            self::$columnsCache = [];
            foreach (Schema::getColumnListing('gl_trans') as $name) {
                self::$columnsCache[strtolower($name)] = true;
            }
        }

        return isset(self::$columnsCache[strtolower($column)]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    public static function insertLines(array $lines): void
    {
        if ($lines === [] || ! self::hasTable()) {
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
        if (! self::hasTable()) {
            return false;
        }

        $query = self::postedQuery($transType, $typeNo);

        if ($account !== null && self::hasColumn('account')) {
            $query->where('account', $account);
        }

        return $query->exists();
    }

    public static function deletePosted(int $transType, int $typeNo): int
    {
        if (! self::hasTable()) {
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
        if (! self::hasTable()) {
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
        if (! self::hasTable() || $memoPrefix === '') {
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
        if (! self::hasTable()) {
            return null;
        }
        if (self::hasColumn('memo')) {
            return 'memo';
        }
        if (self::hasColumn('memo_')) {
            return 'memo_';
        }

        return null;
    }

    private static function postedQuery(int $transType, int $typeNo)
    {
        $query = DB::table('gl_trans')
            ->where('type', (string) $transType);

        if (self::hasColumn('type_no')) {
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

        if (self::hasColumn('type')) {
            $row['type'] = is_numeric($transType) ? (string) (int) $transType : (string) $transType;
        }
        if (self::hasColumn('reference')) {
            $row['reference'] = $line['reference'] ?? null;
        }
        if (self::hasColumn('date')) {
            $row['date'] = $date;
        }
        if (self::hasColumn('account')) {
            $account = $line['account'] ?? null;
            $row['account'] = is_string($account) ? trim($account) : $account;
        }
        if (self::hasColumn('cost_center_id')) {
            $row['cost_center_id'] = $costCenter;
        }

        $costCenter2 = $line['cost_center2_id'] ?? null;
        if ($costCenter2 !== null && $costCenter2 !== '' && (int) $costCenter2 > 0
            && self::hasColumn('cost_center2_id')) {
            $row['cost_center2_id'] = (int) $costCenter2;
        }
        if (self::hasColumn('debit')) {
            $row['debit'] = $debit;
        }
        if (self::hasColumn('credit')) {
            $row['credit'] = $credit;
        }
        $memo = $line['memo'] ?? $line['memo_'] ?? null;
        if (self::hasColumn('memo')) {
            $row['memo'] = $memo;
        }
        if (self::hasColumn('memo_')) {
            $row['memo_'] = $memo;
        }
        if (self::hasColumn('tran_date')) {
            $row['tran_date'] = $date;
        }
        if (self::hasColumn('amount')) {
            $row['amount'] = $debit > 0 ? $debit : -$credit;
        }
        if (self::hasColumn('type_no') && isset($line['type_no'])) {
            $row['type_no'] = (int) $line['type_no'];
        }
        if (self::hasColumn('person_type_id')) {
            $row['person_type_id'] = $line['person_type_id'] ?? null;
        }
        if (self::hasColumn('person_id')) {
            $row['person_id'] = $line['person_id'] ?? null;
        }
        if (self::hasColumn('created_at')) {
            $row['created_at'] = now();
        }
        if (self::hasColumn('updated_at')) {
            $row['updated_at'] = now();
        }

        if (! self::usesNumericId() && self::hasColumn('id')) {
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
        if (self::$numericIdCache !== null) {
            return self::$numericIdCache;
        }

        if (! self::hasTable() || ! self::hasColumn('id')) {
            return self::$numericIdCache = true;
        }

        try {
            $type = Schema::getColumnType('gl_trans', 'id');

            return self::$numericIdCache = in_array($type, ['bigint', 'integer', 'int'], true);
        } catch (\Throwable) {
            return self::$numericIdCache = true;
        }
    }
}
