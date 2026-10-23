<?php

namespace App\Services\Inventory;

use App\Models\StockMaster;
use App\Services\Accounting\PostingsService;
use App\Services\FiscalYear\TransactionReferenceService;
use App\Services\FixedAssets\FaDepreciationService;
use App\Support\ActiveFiscalYear;
use App\Support\GlPostingRunner;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

/**
 * FrontAccounting add_stock_transfer() / add_stock_adjustment() for inventory items.
 */
class InventoryTransactionService
{
    public const TYPE_TRANSFER = 16;

    public const TYPE_ADJUSTMENT = 17;

    private const SERVICE_MB_FLAG = 3;

    public function __construct(
        private StockMoveWriter $writer,
        private LocStockQuantityService $locStock,
        private TransactionReferenceService $references,
        private PostingsService $postings,
    ) {}

    /**
     * @param  array{
     *     from_loc_code:string,
     *     to_loc_code:string,
     *     trans_date:string,
     *     reference?:string|null,
     *     comments?:string|null
     * }  $header
     * @param  array<int, array{stock_id:string,quantity:float}>  $lines
     */
    public function transfer(array $header, array $lines): array
    {
        return DB::transaction(function () use ($header, $lines) {
            $fromLoc = strtoupper(trim((string) ($header['from_loc_code'] ?? '')));
            $toLoc = strtoupper(trim((string) ($header['to_loc_code'] ?? '')));
            if ($fromLoc === '' || $toLoc === '') {
                throw new InvalidArgumentException('From and to locations are required.');
            }
            if ($fromLoc === $toLoc) {
                throw new InvalidArgumentException('From and to locations cannot be the same.');
            }

            $transDate = (string) ($header['trans_date'] ?? now()->toDateString());
            $validLines = $this->normalizeLines($lines, self::TYPE_TRANSFER);
            $transNo = $this->writer->nextTransNo(self::TYPE_TRANSFER);
            $reference = $this->resolveReference(self::TYPE_TRANSFER, $transNo, $transDate, $header['reference'] ?? null);

            $moves = [];
            foreach ($validLines as $line) {
                $stockId = (string) $line['stock_id'];
                $qty = (float) $line['quantity'];
                $this->assertInventoryItem($stockId, self::TYPE_TRANSFER);

                $qoh = $this->writer->quantityOnHand($stockId, $fromLoc);
                if ($qty > $qoh + 0.0001) {
                    throw new InvalidArgumentException(
                        "Insufficient quantity on hand for {$stockId} at {$fromLoc}. Available: {$qoh}"
                    );
                }

                $out = $this->writer->insert($stockId, $fromLoc, -$qty, self::TYPE_TRANSFER, $reference, $transDate, $transNo, 0);
                $in = $this->writer->insert($stockId, $toLoc, $qty, self::TYPE_TRANSFER, $reference, $transDate, $transNo, 0);
                $this->locStock->applyStockMoveRecord($out);
                $this->locStock->applyStockMoveRecord($in);
                $moves[] = $out;
                $moves[] = $in;
            }

            $this->addComment(self::TYPE_TRANSFER, $transNo, $transDate, (string) ($header['comments'] ?? ''));
            $this->addAuditTrail(self::TYPE_TRANSFER, $transNo, $transDate, 'Created');

            return [
                'message' => 'Inventory location transfer posted.',
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_TRANSFER,
                'reference' => $reference,
                'trans_date' => $transDate,
                'from_loc_code' => $fromLoc,
                'to_loc_code' => $toLoc,
                'items' => $this->aggregateTransferItems($transNo),
                'stock_moves' => $moves,
            ];
        });
    }

    /**
     * @param  array{
     *     loc_code:string,
     *     trans_date:string,
     *     reference?:string|null,
     *     comments?:string|null
     * }  $header
     * @param  array<int, array{stock_id:string,quantity:float,standard_cost?:float}>  $lines
     */
    public function adjustment(array $header, array $lines): array
    {
        return DB::transaction(function () use ($header, $lines) {
            $locCode = strtoupper(trim((string) ($header['loc_code'] ?? '')));
            if ($locCode === '') {
                throw new InvalidArgumentException('Location is required.');
            }

            $transDate = (string) ($header['trans_date'] ?? now()->toDateString());
            $validLines = $this->normalizeLines($lines, self::TYPE_ADJUSTMENT, true);
            $transNo = $this->writer->nextTransNo(self::TYPE_ADJUSTMENT);
            $reference = $this->resolveReference(self::TYPE_ADJUSTMENT, $transNo, $transDate, $header['reference'] ?? null);

            $moves = [];
            foreach ($validLines as $line) {
                $stockId = (string) $line['stock_id'];
                $qty = (float) $line['quantity'];
                $this->assertInventoryItem($stockId, self::TYPE_ADJUSTMENT);

                if ($qty < 0) {
                    $qoh = $this->writer->quantityOnHand($stockId, $locCode);
                    if (abs($qty) > $qoh + 0.0001) {
                        throw new InvalidArgumentException(
                            "Adjustment would reduce quantity below zero for {$stockId} at {$locCode}. On hand: {$qoh}"
                        );
                    }
                }

                $item = StockMaster::query()->where('stock_id', $stockId)->first();
                $unitCost = array_key_exists('standard_cost', $line)
                    ? (float) $line['standard_cost']
                    : (float) ($item?->material_cost ?? 0);
                if ($unitCost <= 0) {
                    $unitCost = (float) ($item?->purchase_cost ?? 0);
                }

                $move = $this->writer->insert(
                    $stockId,
                    $locCode,
                    $qty,
                    self::TYPE_ADJUSTMENT,
                    $reference,
                    $transDate,
                    $transNo,
                    $unitCost
                );
                $this->locStock->applyStockMoveRecord($move, $line['batch'] ?? []);
                $moves[] = $move;
            }

            $glWarning = null;
            $run = GlPostingRunner::run(fn () => $this->postings->repostInventoryAdjustmentTransaction($transNo));
            $glWarning = $run['gl_warning'];

            $this->addComment(self::TYPE_ADJUSTMENT, $transNo, $transDate, (string) ($header['comments'] ?? ''));
            $this->addAuditTrail(self::TYPE_ADJUSTMENT, $transNo, $transDate, 'Created');

            $result = [
                'message' => 'Inventory adjustment posted.',
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_ADJUSTMENT,
                'reference' => $reference,
                'trans_date' => $transDate,
                'loc_code' => $locCode,
                'items' => $this->aggregateAdjustmentItems($transNo),
                'stock_moves' => $moves,
            ];
            if ($glWarning) {
                $result['gl_warning'] = $glWarning;
            }

            return $result;
        });
    }

    public function showTransfer(int $transNo): ?array
    {
        if ($transNo <= 0 || ! Schema::hasTable('stock_moves')) {
            return null;
        }

        $header = $this->transferHeader($transNo);
        if (! $header) {
            return null;
        }

        return [
            ...$header,
            'trans_type' => self::TYPE_TRANSFER,
            'items' => $this->aggregateTransferItems($transNo),
        ];
    }

    public function showAdjustment(int $transNo): ?array
    {
        if ($transNo <= 0 || ! Schema::hasTable('stock_moves')) {
            return null;
        }

        $row = DB::table('stock_moves')
            ->where('type', self::TYPE_ADJUSTMENT)
            ->where('trans_no', $transNo)
            ->orderBy('trans_id')
            ->first();

        if (! $row) {
            return null;
        }

        return [
            'trans_no' => $transNo,
            'trans_type' => self::TYPE_ADJUSTMENT,
            'reference' => (string) ($row->reference ?? ''),
            'trans_date' => (string) ($row->tran_date ?? ''),
            'loc_code' => (string) ($row->loc_code ?? ''),
            'items' => $this->aggregateAdjustmentItems($transNo),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     * @return array<int, array{stock_id:string,quantity:float,standard_cost?:float}>
     */
    private function normalizeLines(array $lines, int $type, bool $allowNegative = false): array
    {
        $valid = [];
        foreach ($lines as $line) {
            $stockId = trim((string) ($line['stock_id'] ?? ''));
            $qty = (float) ($line['quantity'] ?? 0);
            if ($stockId === '') {
                continue;
            }
            if ($allowNegative) {
                if (abs($qty) < 0.0001) {
                    continue;
                }
            } elseif ($qty <= 0) {
                continue;
            }

            $entry = ['stock_id' => $stockId, 'quantity' => $qty];
            if ($type === self::TYPE_ADJUSTMENT && array_key_exists('standard_cost', $line)) {
                $entry['standard_cost'] = (float) $line['standard_cost'];
            }
            // Optional stock-batch context (which packets) — never affects accounting.
            if ($type === self::TYPE_ADJUSTMENT && ! empty($line['batch']) && is_array($line['batch'])) {
                $entry['batch'] = $line['batch'];
            }
            $valid[] = $entry;
        }

        if ($valid === []) {
            throw new InvalidArgumentException('Add at least one line with a non-zero quantity.');
        }

        return $valid;
    }

    private function assertInventoryItem(string $stockId, int $type): void
    {
        $item = StockMaster::query()->where('stock_id', $stockId)->first();
        if (! $item) {
            throw new InvalidArgumentException("Item {$stockId} was not found.");
        }

        $mbFlag = (int) ($item->mb_flag ?? 0);
        if ($mbFlag === FaDepreciationService::FA_MB_FLAG) {
            throw new InvalidArgumentException("Item {$stockId} is a fixed asset. Use Fixed Assets transfers.");
        }
        if ($mbFlag === self::SERVICE_MB_FLAG && $type === self::TYPE_ADJUSTMENT) {
            throw new InvalidArgumentException("Cannot adjust inventory for service item {$stockId}.");
        }
    }

    private function resolveReference(int $transType, int $transNo, string $transDate, ?string $reference): string
    {
        $reference = trim((string) ($reference ?? ''));
        if ($reference !== '') {
            return $reference;
        }

        $refData = $this->references->next($transType, $transDate);

        return (string) ($refData['reference'] ?? sprintf('%03d/%s', $transNo, date('Y', strtotime($transDate))));
    }

    /**
     * @return array<string, mixed>|null
     */
    private function transferHeader(int $transNo): ?array
    {
        $from = DB::table('stock_moves as m')
            ->leftJoin('locations as l', 'm.loc_code', '=', 'l.loc_code')
            ->where('m.type', self::TYPE_TRANSFER)
            ->where('m.trans_no', $transNo)
            ->where('m.qty', '<', 0)
            ->select('m.reference', 'm.tran_date', 'm.loc_code as from_loc_code', 'l.location_name as from_loc_name')
            ->first();

        $to = DB::table('stock_moves as m')
            ->leftJoin('locations as l', 'm.loc_code', '=', 'l.loc_code')
            ->where('m.type', self::TYPE_TRANSFER)
            ->where('m.trans_no', $transNo)
            ->where('m.qty', '>', 0)
            ->select('m.loc_code as to_loc_code', 'l.location_name as to_loc_name')
            ->first();

        if (! $from) {
            return null;
        }

        return [
            'trans_no' => $transNo,
            'reference' => (string) ($from->reference ?? ''),
            'trans_date' => (string) ($from->tran_date ?? ''),
            'from_loc_code' => (string) ($from->from_loc_code ?? ''),
            'from_loc_name' => (string) ($from->from_loc_name ?? ''),
            'to_loc_code' => (string) ($to->to_loc_code ?? ''),
            'to_loc_name' => (string) ($to->to_loc_name ?? ''),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function aggregateTransferItems(int $transNo): array
    {
        $rows = DB::table('stock_moves as m')
            ->leftJoin('stock_master as s', 'm.stock_id', '=', 's.stock_id')
            ->where('m.type', self::TYPE_TRANSFER)
            ->where('m.trans_no', $transNo)
            ->where('m.qty', '>', 0)
            ->select('m.stock_id', 's.description', 's.units', 'm.qty')
            ->orderBy('m.stock_id')
            ->get();

        return $rows->map(fn ($row) => [
            'stock_id' => (string) $row->stock_id,
            'item_code' => (string) $row->stock_id,
            'description' => (string) ($row->description ?? ''),
            'quantity' => (float) $row->qty,
            'unit' => (string) ($row->units ?? ''),
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function aggregateAdjustmentItems(int $transNo): array
    {
        $rows = DB::table('stock_moves as m')
            ->leftJoin('stock_master as s', 'm.stock_id', '=', 's.stock_id')
            ->where('m.type', self::TYPE_ADJUSTMENT)
            ->where('m.trans_no', $transNo)
            ->select('m.stock_id', 's.description', 's.units', 'm.qty', 'm.standard_cost')
            ->orderBy('m.stock_id')
            ->get();

        return $rows->map(fn ($row) => [
            'stock_id' => (string) $row->stock_id,
            'item_code' => (string) $row->stock_id,
            'description' => (string) ($row->description ?? ''),
            'quantity' => (float) $row->qty,
            'unit' => (string) ($row->units ?? ''),
            'unit_cost' => (float) ($row->standard_cost ?? 0),
            'total' => round((float) $row->qty * (float) ($row->standard_cost ?? 0), 2),
        ])->all();
    }

    private function addComment(int $type, int $transNo, string $date, string $memo): void
    {
        if ($memo === '' || ! Schema::hasTable('comments')) {
            return;
        }
        DB::table('comments')->insert([
            'type' => $type, 'id' => $transNo, 'date_' => $date, 'memo_' => $memo,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function addAuditTrail(int $type, int $transNo, string $glDate, string $description): void
    {
        if (! Schema::hasTable('audit_trail')) {
            return;
        }
        $range = ActiveFiscalYear::range($glDate);
        DB::table('audit_trail')->insert([
            'type' => $type, 'trans_no' => $transNo, 'user' => (int) (Auth::id() ?? 0),
            'description' => substr($description, 0, 60), 'fiscal_year' => (int) ($range['id'] ?? 0),
            'gl_date' => $glDate, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
