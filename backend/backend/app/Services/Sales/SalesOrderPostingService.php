<?php

namespace App\Services\Sales;

use App\Models\SalesOrder;
use App\Models\SalesOrderDetail;
use App\Support\SalesOrderPrepAmount;
use Illuminate\Support\Facades\DB;

/**
 * FrontAccounting-style: header + lines in one DB transaction (all or nothing).
 */
class SalesOrderPostingService
{
    /**
     * @param  array<string, mixed>  $header
     * @param  list<array<string, mixed>>  $lines
     * @return array{order: SalesOrder, lines: list<SalesOrderDetail>}
     */
    public function createWithDetails(array $header, array $lines): array
    {
        if ($lines === []) {
            throw new \InvalidArgumentException('At least one order line is required.');
        }

        return DB::transaction(function () use ($header, $lines) {
            $order = $this->createHeader($this->normalizeHeader($header));
            $createdLines = [];
            foreach ($lines as $line) {
                $line['order_no'] = $order->order_no;
                $line['trans_type'] = $line['trans_type'] ?? $order->trans_type;
                $createdLines[] = SalesOrderDetail::query()->create($line);
            }

            return ['order' => $order->fresh(), 'lines' => $createdLines];
        });
    }

    /**
     * @param  array<string, mixed>  $header
     * @param  list<array<string, mixed>>  $lines
     * @param  list<int|string>  $deleteDetailIds
     * @return array{order: SalesOrder, lines: list<SalesOrderDetail>}
     */
    public function updateWithDetails(
        int $orderNo,
        array $header,
        array $lines,
        array $deleteDetailIds = []
    ): array {
        if ($lines === []) {
            throw new \InvalidArgumentException('At least one order line is required.');
        }

        return DB::transaction(function () use ($orderNo, $header, $lines, $deleteDetailIds) {
            $order = SalesOrder::query()->where('order_no', $orderNo)->firstOrFail();
            $order->update($this->normalizeHeader($header));

            if ($deleteDetailIds !== []) {
                SalesOrderDetail::query()
                    ->where('order_no', $orderNo)
                    ->whereIn('id', $deleteDetailIds)
                    ->delete();
            }

            $createdLines = [];
            foreach ($lines as $line) {
                $line['order_no'] = $orderNo;
                $line['trans_type'] = $line['trans_type'] ?? $order->trans_type;
                $detailId = $line['id'] ?? null;
                unset($line['id']);

                if ($detailId) {
                    $detail = SalesOrderDetail::query()
                        ->where('order_no', $orderNo)
                        ->where('id', $detailId)
                        ->first();
                    if ($detail) {
                        $detail->update($line);
                        $createdLines[] = $detail->fresh();
                        continue;
                    }
                }

                $createdLines[] = SalesOrderDetail::query()->create($line);
            }

            return ['order' => $order->fresh(), 'lines' => $createdLines];
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function createHeader(array $data): SalesOrder
    {
        // order_no has no DB default/auto-increment, so it must always be
        // set proactively — leaving it unset previously threw MySQL error
        // 1364 (not the duplicate-key 23000 the retry loop below watches
        // for), so every first insert failed outright before the retry
        // logic ever got a chance to run.
        if (empty($data['order_no'])) {
            $data['order_no'] = (int) (DB::table('sales_orders')->max('order_no') ?? 0) + 1;
        }

        $attempts = 0;
        while ($attempts < 3) {
            try {
                return SalesOrder::query()->create($data);
            } catch (\Illuminate\Database\QueryException $e) {
                $attempts++;
                // SQLSTATE 23000 covers every integrity-constraint violation
                // (duplicate key AND foreign key failures alike) — only the
                // MySQL-native 1062 is actually "order_no already taken".
                // Retrying on anything else just masked the real error (e.g.
                // an invalid branch_code) behind a misleading "unable to
                // allocate order_no" message.
                $mysqlErrorCode = $e->errorInfo[1] ?? null;
                if ($mysqlErrorCode === 1062) {
                    $max = (int) (DB::table('sales_orders')->max('order_no') ?? 0);
                    $data['order_no'] = $max + 1;
                    continue;
                }
                throw $e;
            }
        }

        throw new \RuntimeException('Unable to allocate unique order_no after retries');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeHeader(array $data): array
    {
        $data['delivery_address'] = trim((string) ($data['delivery_address'] ?? ''));
        $data['deliver_to'] = trim((string) ($data['deliver_to'] ?? ''));
        $data['customer_ref'] = $data['customer_ref'] ?? null;
        $data['comments'] = $data['comments'] ?? null;
        $data['freight_cost'] = (float) ($data['freight_cost'] ?? 0);
        $data['from_stk_loc'] = (string) ($data['from_stk_loc'] ?? '');

        $orderType = (int) ($data['order_type'] ?? 0);
        if ($orderType <= 0 || ! DB::table('sales_types')->where('id', $orderType)->exists()) {
            throw new \InvalidArgumentException('Invalid or missing price list (sales type). Please select a valid price list.');
        }

        $data['prep_amount'] = SalesOrderPrepAmount::resolve($data);

        return $data;
    }
}
