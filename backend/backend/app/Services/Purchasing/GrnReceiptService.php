<?php

namespace App\Services\Purchasing;

use App\Models\GrnItem;
use App\Models\PurchOrder;
use App\Models\PurchOrderDetail;
use App\Services\Accounting\PostingsService;
use App\Services\FiscalYear\TransactionReferenceService;
use App\Services\FixedAssets\FaDepreciationService;
use App\Services\Inventory\LocStockQuantityService;
use App\Support\ActiveFiscalYear;
use App\Support\GlPostingRunner;
use App\Support\GlTransHelper;
use App\Support\SupplierExchangeRate;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

/**
 * FrontAccounting add_grn() / po_receive_items.php — atomic GRN receipt.
 */
class GrnReceiptService
{
    public const TYPE_GRN = 25;

    public function __construct(
        private PurchOrderPostingService $poPosting,
        private TransactionReferenceService $references,
        private LocStockQuantityService $locStockQty,
        private PostingsService $postings,
    ) {}

    /**
     * Receive items against an existing purchase order.
     *
     * @param  array{
     *     order_no:int,
     *     reference?:string|null,
     *     delivery_date:string,
     *     loc_code?:string|null,
     *     comments?:string|null,
     *     lines: array<int, array{po_detail_item:int, quantity:float}>
     * }  $payload
     */
    public function receiveFromPurchaseOrder(array $payload): array
    {
        return DB::transaction(function () use ($payload) {
            $orderNo = (int) ($payload['order_no'] ?? 0);
            if ($orderNo <= 0) {
                throw new InvalidArgumentException('Purchase order number is required.');
            }

            $order = PurchOrder::query()->where('order_no', $orderNo)->first();
            if (! $order) {
                throw new InvalidArgumentException("Purchase order {$orderNo} not found.");
            }

            $lines = $payload['lines'] ?? [];
            if ($lines === []) {
                throw new InvalidArgumentException('At least one receive line is required.');
            }

            $deliveryDate = (string) ($payload['delivery_date'] ?? now()->toDateString());
            $locCode = trim((string) ($payload['loc_code'] ?? $order->into_stock_location ?? ''));
            if ($locCode === '') {
                throw new InvalidArgumentException('Stock location is required.');
            }

            $reference = trim((string) ($payload['reference'] ?? ''));
            if ($reference === '') {
                $refData = $this->references->next(self::TYPE_GRN, $deliveryDate);
                $reference = (string) ($refData['reference'] ?? 'GRN-'.$orderNo);
            }

            $batchId = $this->createGrnBatch(
                (int) $order->supplier_id,
                $orderNo,
                $reference,
                $deliveryDate,
                $locCode,
                $order->cost_center_id
            );

            $grnItems = [];
            foreach ($lines as $input) {
                $poDetailItem = (int) ($input['po_detail_item'] ?? 0);
                $qty = round((float) ($input['quantity'] ?? 0), 4);
                if ($qty <= 0) {
                    continue;
                }

                $detail = PurchOrderDetail::query()
                    ->where('order_no', $orderNo)
                    ->where('po_detail_item', $poDetailItem)
                    ->first();

                if (! $detail) {
                    throw new InvalidArgumentException("PO line {$poDetailItem} not found.");
                }

                $remaining = max(0.0, (float) $detail->quantity_ordered - (float) $detail->quantity_received);
                if ($qty > $remaining + 0.0001) {
                    throw new InvalidArgumentException(
                        sprintf(
                            'Receive quantity for %s exceeds outstanding PO quantity (%.4f remaining).',
                            $detail->item_code,
                            $remaining
                        )
                    );
                }

                $unitCost = $this->resolveUnitCost($detail);
                $grnItem = GrnItem::query()->create([
                    'grn_batch_id' => $batchId,
                    'po_detail_item' => $poDetailItem,
                    'item_code' => $detail->item_code,
                    'description' => $detail->description,
                    'qty_recd' => $qty,
                    'quantity_inv' => 0,
                ]);

                $detail->update([
                    'quantity_received' => round((float) $detail->quantity_received + $qty, 4),
                    'act_price' => $unitCost,
                ]);

                $this->postStockMove($batchId, $detail->item_code, $locCode, $deliveryDate, $reference, $qty, $unitCost, $input);
                $grnItems[] = $grnItem;
            }

            if ($grnItems === []) {
                throw new InvalidArgumentException('No receive quantities to process.');
            }

            $glWarning = $this->postGrnGl($batchId);
            $this->addComment(self::TYPE_GRN, $batchId, $deliveryDate, (string) ($payload['comments'] ?? ''));
            $this->addAuditTrail(self::TYPE_GRN, $batchId, $deliveryDate, 'Created');

            $result = [
                'grn_batch_id' => $batchId,
                'order_no' => $orderNo,
                'reference' => $reference,
                'items' => array_map(fn ($i) => $i->toArray(), $grnItems),
            ];
            if ($glWarning) {
                $result['gl_warning'] = $glWarning;
            }

            return $result;
        });
    }

    /**
     * Direct GRN — creates PO + GRN in one transaction (FA po_entry_items.php?NewGRN=Yes).
     *
     * @param  array{
     *     supplier_id:int,
     *     reference?:string|null,
     *     delivery_date:string,
     *     into_stock_location:string,
     *     delivery_address?:string|null,
     *     tax_included?:bool,
     *     comments?:string|null,
     *     total?:float,
     *     fixed_asset?:bool,
     *     lines: array<int, array{item_code:string, description?:string|null, quantity:float, unit_price:float, delivery_date?:string|null}>
     * }  $payload
     */
    public function directGrn(array $payload): array
    {
        return DB::transaction(function () use ($payload) {
            $supplierId = (int) ($payload['supplier_id'] ?? 0);
            if ($supplierId <= 0) {
                throw new InvalidArgumentException('Supplier is required.');
            }

            $fixedAsset = (bool) ($payload['fixed_asset'] ?? false);
            $lines = $payload['lines'] ?? [];
            if ($lines === []) {
                throw new InvalidArgumentException('At least one GRN line is required.');
            }

            if ($fixedAsset) {
                foreach ($lines as $line) {
                    $stockId = (string) ($line['item_code'] ?? '');
                    $mbFlag = $stockId !== '' && Schema::hasTable('stock_master')
                        ? (int) DB::table('stock_master')->where('stock_id', $stockId)->value('mb_flag')
                        : 0;
                    if ($mbFlag !== FaDepreciationService::FA_MB_FLAG) {
                        throw new InvalidArgumentException("Item {$stockId} is not a fixed asset.");
                    }
                }
            }

            $deliveryDate = (string) ($payload['delivery_date'] ?? now()->toDateString());
            $locCode = trim((string) ($payload['into_stock_location'] ?? ''));
            if ($locCode === '') {
                throw new InvalidArgumentException('Stock location is required.');
            }

            $maxOrder = (int) (DB::table('purch_orders')->max('order_no') ?? 0);
            $orderNo = $maxOrder + 1;

            $reference = trim((string) ($payload['reference'] ?? ''));
            if ($reference === '') {
                $refData = $this->references->next(18, $deliveryDate);
                $reference = (string) ($refData['reference'] ?? 'PO-'.$orderNo);
            }

            $poLines = [];
            // Same order as $poLines — the selling price / MRP typed for each line's new batch.
            $batchPrices = [];
            $total = 0.0;
            foreach ($lines as $line) {
                $qty = round((float) ($line['quantity'] ?? 0), 4);
                $price = round((float) ($line['unit_price'] ?? 0), 4);
                if ($qty <= 0) {
                    continue;
                }
                $batchPrices[] = $line;
                $stdCost = $this->stockMaterialCost((string) ($line['item_code'] ?? ''));
                $poLines[] = [
                    'item_code' => (string) ($line['item_code'] ?? ''),
                    'description' => $line['description'] ?? null,
                    'delivery_date' => $line['delivery_date'] ?? $deliveryDate,
                    'qty_invoiced' => 0,
                    'unit_price' => $price,
                    'discount_percent' => round((float) ($line['discount_percent'] ?? 0), 4),
                    'act_price' => $price,
                    'std_cost_unit' => $stdCost,
                    'quantity_ordered' => $qty,
                    'quantity_received' => $qty,
                ];
                $discPct = (float) ($line['discount_percent'] ?? 0);
                $total += $qty * $price * (1 - $discPct / 100);
            }

            if ($poLines === []) {
                throw new InvalidArgumentException('No valid GRN quantities.');
            }

            $poResult = $this->poPosting->createWithDetails([
                'order_no' => $orderNo,
                'supplier_id' => $supplierId,
                'comments' => $payload['comments'] ?? null,
                'ord_date' => $deliveryDate,
                'reference' => $reference,
                'requisition_no' => null,
                'into_stock_location' => $locCode,
                'delivery_address' => trim((string) ($payload['delivery_address'] ?? '')),
                'total' => round((float) ($payload['total'] ?? $total), 2),
                'prep_amount' => 0,
                'alloc' => 0,
                'tax_included' => (bool) ($payload['tax_included'] ?? false),
                'cost_center_id' => (int) ($payload['cost_center_id'] ?? 0),
            ], $poLines);

            $grnRef = $reference;
            $batchId = $this->createGrnBatch($supplierId, $orderNo, $grnRef, $deliveryDate, $locCode, (int) ($payload['cost_center_id'] ?? 0));

            $grnItems = [];
            foreach (array_values($poResult['lines']) as $lineIndex => $detail) {
                $qty = (float) $detail->quantity_received;
                $grnItem = GrnItem::query()->create([
                    'grn_batch_id' => $batchId,
                    'po_detail_item' => $detail->po_detail_item,
                    'item_code' => $detail->item_code,
                    'description' => $detail->description,
                    'qty_recd' => $qty,
                    'quantity_inv' => 0,
                ]);

                $unitCost = $this->resolveUnitCost($detail);
                $this->postStockMove($batchId, $detail->item_code, $locCode, $deliveryDate, $grnRef, $qty, $unitCost, $batchPrices[$lineIndex] ?? []);
                $grnItems[] = $grnItem;
            }

            $glWarning = $this->postGrnGl($batchId);
            $this->addComment(self::TYPE_GRN, $batchId, $deliveryDate, (string) ($payload['comments'] ?? ''));
            $this->addAuditTrail(self::TYPE_GRN, $batchId, $deliveryDate, 'Created');

            $result = [
                'order_no' => $orderNo,
                'grn_batch_id' => $batchId,
                'reference' => $grnRef,
                'order' => $poResult['order']->toArray(),
                'items' => array_map(fn ($i) => $i->toArray(), $grnItems),
            ];
            if ($glWarning) {
                $result['gl_warning'] = $glWarning;
            }

            return $result;
        });
    }

    private function createGrnBatch(
        int $supplierId,
        int $orderNo,
        string $reference,
        string $deliveryDate,
        string $locCode,
        ?int $costCenterId = null
    ): int {
        return (int) DB::table('grn_batch')->insertGetId([
            'supplier_id' => $supplierId,
            'purch_order_no' => $orderNo,
            'reference' => $reference,
            'delivery_date' => $deliveryDate,
            'loc_code' => $locCode,
            'cost_center_id' => $costCenterId ?? 0,
            'rate' => SupplierExchangeRate::forSupplier($supplierId, $deliveryDate),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function postStockMove(
        int $batchId,
        string $stockId,
        string $locCode,
        string $tranDate,
        string $reference,
        float $qty,
        float $unitCost,
        array $line = []
    ): void {
        // Every received line opens its own stock batch with the selling price and
        // MRP typed for it (falls back to the product's current price / MRP).
        $batch = [
            'new_batch' => [
                'purchase_cost' => $unitCost,
                'selling_price' => $line['selling_price'] ?? null,
                'mrp' => $line['mrp_price'] ?? $line['mrp'] ?? null,
            ],
            'source_type' => 'grn',
            'source_no' => $batchId,
            'trans_type' => self::TYPE_GRN,
            'trans_no' => $batchId,
        ];

        if (! Schema::hasTable('stock_moves')) {
            $this->locStockQty->applyMoveDelta($stockId, $locCode, $qty, $batch);

            return;
        }

        DB::table('stock_moves')->insert([
            'trans_no' => $batchId,
            'stock_id' => $stockId,
            'type' => self::TYPE_GRN,
            'loc_code' => $locCode,
            'tran_date' => $tranDate,
            'price' => $unitCost,
            'reference' => $reference,
            'qty' => $qty,
            'standard_cost' => $unitCost,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->locStockQty->applyMoveDelta($stockId, $locCode, $qty, $batch);
        $this->updateMaterialCost($stockId, $qty, $unitCost);
        $this->applyNewSellingPrice($stockId, $line);
    }

    /**
     * A selling price / MRP typed on the GRN line becomes the product's current
     * price (what single-price items charge and what the next batch defaults to).
     * Older batches keep their own price until they are sold out.
     */
    private function applyNewSellingPrice(string $stockId, array $line): void
    {
        $oldMrp = DB::table('stock_master')->where('stock_id', $stockId)->value('mrp_price');
        $oldMrp = $oldMrp === null ? null : (float) $oldMrp;
        $selling = $line['selling_price'] ?? null;
        if ($selling !== null && $selling !== '' && is_numeric($selling) && (float) $selling > 0 && Schema::hasTable('sales_pricing')) {
            $existing = DB::table('sales_pricing')
                ->where('stock_id', $stockId)->where('sales_type_id', 3)->where('currency_id', 8)
                ->first();
            if ($existing) {
                DB::table('sales_pricing')->where('id', $existing->id)->update(['price' => (float) $selling, 'updated_at' => now()]);
            } else {
                DB::table('sales_pricing')->insert([
                    'stock_id' => $stockId, 'sales_type_id' => 3, 'currency_id' => 8,
                    'price' => (float) $selling, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
        $mrp = $line['mrp_price'] ?? $line['mrp'] ?? null;
        $newMrp = $mrp !== null && $mrp !== '' && is_numeric($mrp) && (float) $mrp > 0 ? (float) $mrp : null;
        if ($newMrp !== null) {
            DB::table('stock_master')->where('stock_id', $stockId)->update(['mrp_price' => $newMrp, 'updated_at' => now()]);
        }
        // Same MRP as the packets already in stock = same packets: they all take the
        // new price. A different MRP is a new packet — older packets keep their price.
        $sameMrp = $newMrp === null || ($oldMrp !== null && abs($newMrp - $oldMrp) < 0.005);
        if ($sameMrp && $selling !== null && $selling !== '' && is_numeric($selling) && (float) $selling > 0) {
            app(\App\Services\Inventory\StockBatchService::class)->followProductPrice($stockId);
        }
    }

    private function updateMaterialCost(string $stockId, float $qty, float $unitCost): void
    {
        if (! Schema::hasTable('stock_master')) {
            return;
        }

        $stock = DB::table('stock_master')->where('stock_id', $stockId)->first();
        if (! $stock) {
            return;
        }

        $onHand = (float) DB::table('stock_moves')->where('stock_id', $stockId)->sum('qty');
        $oldQty = max(0, $onHand - $qty);
        $oldCost = (float) ($stock->material_cost ?? 0);
        $newCost = ($oldQty + $qty) > 0
            ? round((($oldQty * $oldCost) + ($qty * $unitCost)) / ($oldQty + $qty), 4)
            : $unitCost;

        DB::table('stock_master')->where('stock_id', $stockId)->update([
            'material_cost' => $newCost,
            'updated_at' => now(),
        ]);
    }

    private function resolveUnitCost(PurchOrderDetail $detail): float
    {
        $price = (float) ($detail->unit_price ?? 0);
        if ($price > 0) {
            return $price;
        }

        return $this->stockMaterialCost((string) $detail->item_code);
    }

    private function stockMaterialCost(string $stockId): float
    {
        if ($stockId === '' || ! Schema::hasTable('stock_master')) {
            return 0.0;
        }

        $row = DB::table('stock_master')->where('stock_id', $stockId)->first();

        return (float) ($row->material_cost ?? 0);
    }

    private function postGrnGl(int $batchId): ?string
    {
        $run = GlPostingRunner::run(fn () => $this->postings->postGrnBatch($batchId));

        return $run['gl_warning'];
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

    public function void(int $batchId, ?string $memo = null): array
    {
        return DB::transaction(function () use ($batchId, $memo) {
            if ($batchId <= 0 || ! Schema::hasTable('grn_batch')) {
                throw new InvalidArgumentException('GRN batch not found.');
            }

            $batch = DB::table('grn_batch')->where('id', $batchId)->first();
            if (! $batch) {
                throw new InvalidArgumentException('GRN batch not found.');
            }

            $items = Schema::hasTable('grn_items')
                ? DB::table('grn_items')->where('grn_batch_id', $batchId)->get()
                : collect();

            foreach ($items as $item) {
                if ((float) ($item->quantity_inv ?? 0) > 0.0001) {
                    throw new InvalidArgumentException('Cannot void GRN: one or more lines have been invoiced.');
                }
            }

            $orderNo = (int) ($batch->purch_order_no ?? 0);
            $locCode = (string) ($batch->loc_code ?? '');

            foreach ($items as $item) {
                $qty = (float) ($item->qty_recd ?? 0);
                $stockId = (string) ($item->item_code ?? '');
                if ($qty > 0 && $stockId !== '' && $locCode !== '') {
                    // Take it back out of the batch this GRN created.
                    $this->locStockQty->applyMoveDelta($stockId, $locCode, -$qty, [
                        'from_source' => ['type' => 'grn', 'no' => $batchId],
                        // also finds it when the GRN was added into an existing same-price batch
                        'undo_of' => ['type' => self::TYPE_GRN, 'no' => $batchId],
                        'undo_receipt' => true,
                        'trans_type' => self::TYPE_GRN,
                        'trans_no' => $batchId,
                        'note' => 'GRN void',
                    ]);
                }

                if (Schema::hasTable('stock_moves')) {
                    DB::table('stock_moves')
                        ->where('type', self::TYPE_GRN)
                        ->where('trans_no', $batchId)
                        ->where('stock_id', $stockId)
                        ->delete();
                }

                if ($orderNo > 0 && ! empty($item->po_detail_item)) {
                    DB::table('purch_order_details')
                        ->where('order_no', $orderNo)
                        ->where('po_detail_item', $item->po_detail_item)
                        ->decrement('quantity_received', $qty);
                }
            }

            if (Schema::hasTable('grn_items')) {
                DB::table('grn_items')->where('grn_batch_id', $batchId)->delete();
            }

            GlTransHelper::deletePosted(self::TYPE_GRN, $batchId);
            DB::table('grn_batch')->where('id', $batchId)->delete();

            if ($memo && Schema::hasTable('comments')) {
                $this->addComment(self::TYPE_GRN, $batchId, now()->toDateString(), $memo);
            }
            $this->addAuditTrail(self::TYPE_GRN, $batchId, now()->toDateString(), 'Voided');

            return [
                'message' => 'GRN voided.',
                'trans_type' => self::TYPE_GRN,
                'trans_no' => $batchId,
            ];
        });
    }
}
