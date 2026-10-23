<?php

namespace App\Services\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LocStockQuantityService
{
    public function __construct(private StockBatchService $batches)
    {
    }

    /**
     * @param  array<string, mixed>  $batch  optional batch context — see StockBatchService::applyDelta()
     */
    public function applyMoveDelta(string $stockId, string $locCode, float $qtyDelta, array $batch = []): void
    {
        if (! Schema::hasTable('loc_stock') || ! Schema::hasColumn('loc_stock', 'quantity')) {
            return;
        }

        $stockId = trim($stockId);
        $locCode = strtoupper(trim($locCode));
        if ($stockId === '' || $locCode === '' || abs($qtyDelta) < 1e-12) {
            return;
        }

        $row = DB::table('loc_stock')
            ->where('loc_code', $locCode)
            ->where('stock_id', $stockId)
            ->first();

        if (! $row) {
            DB::table('loc_stock')->insert([
                'loc_code' => $locCode,
                'stock_id' => $stockId,
                'reorder_level' => 0,
                'quantity' => round($qtyDelta, 4),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->batches->applyDelta($stockId, $locCode, $qtyDelta, 0, $batch);

            return;
        }

        $prevQty = (float) ($row->quantity ?? 0);
        DB::table('loc_stock')
            ->where('loc_code', $locCode)
            ->where('stock_id', $stockId)
            ->update([
                'quantity' => round($prevQty + $qtyDelta, 4),
                'updated_at' => now(),
            ]);
        $this->batches->applyDelta($stockId, $locCode, $qtyDelta, $prevQty, $batch);
    }

    /**
     * @param  object|array<string, mixed>|null  $move
     * @param  array<string, mixed>  $batch  optional batch context — see StockBatchService::applyDelta()
     */
    public function applyStockMoveRecord(object|array|null $move, array $batch = []): void
    {
        if ($move === null) {
            return;
        }

        $data = is_array($move) ? $move : (array) $move;
        $stockId = (string) ($data['stock_id'] ?? $data['item_code'] ?? '');
        $locCode = (string) ($data['loc_code'] ?? $data['location'] ?? '');
        $qty = (float) ($data['qty'] ?? $data['quantity'] ?? 0);

        $batch += [
            'trans_type' => isset($data['type']) ? (int) $data['type'] : null,
            'trans_no' => isset($data['trans_no']) ? (int) $data['trans_no'] : null,
        ];

        $this->applyMoveDelta($stockId, $locCode, $qty, $batch);
    }

    /**
     * @param  object|array<string, mixed>|null  $before
     * @param  object|array<string, mixed>|null  $after
     */
    public function reconcileStockMoveChange(object|array|null $before, object|array|null $after): void
    {
        if ($before !== null) {
            $b = is_array($before) ? $before : (array) $before;
            $this->applyMoveDelta(
                (string) ($b['stock_id'] ?? $b['item_code'] ?? ''),
                (string) ($b['loc_code'] ?? $b['location'] ?? ''),
                -1 * (float) ($b['qty'] ?? $b['quantity'] ?? 0),
                [
                    'trans_type' => isset($b['type']) ? (int) $b['type'] : null,
                    'trans_no' => isset($b['trans_no']) ? (int) $b['trans_no'] : null,
                ]
            );
        }

        if ($after !== null) {
            $this->applyStockMoveRecord($after);
        }
    }
}
