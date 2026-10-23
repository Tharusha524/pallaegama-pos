<?php

namespace App\Services\Sales;

use App\Exceptions\GlPostingException;
use App\Models\DebtorTrans;
use App\Services\Accounting\PostingsService;
use App\Services\FixedAssets\FaDepreciationService;
use App\Services\FiscalYear\TransactionReferenceService;
use App\Services\Inventory\LocStockQuantityService;
use App\Support\ActiveFiscalYear;
use App\Support\CustomerExchangeRate;
use App\Support\InventoryPreferences;
use App\Support\SalesKitExploder;
use App\Support\DebtorTransSequence;
use App\Support\GlPostingRunner;
use App\Support\GlTransHelper;
use App\Support\SalesTaxCalculator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

class SalesDeliveryService
{
    public const TYPE_DELIVERY = 13;

    /** Service items — no stock move (FrontAccounting has_stock_holding). */
    private const SERVICE_MB_FLAG = 3;

    public function __construct(
        private CustomerCreditService $customerCredit,
        private TransactionReferenceService $references,
        private SalesTaxCalculator $taxCalculator,
        private LocStockQuantityService $locStockQty,
        private PostingsService $postings,
    ) {}

    /**
     * FrontAccounting write_sales_delivery() equivalent — single DB transaction.
     *
     * @param  array{
     *     order_no:int,
     *     tran_date:string,
     *     due_date?:string|null,
     *     ship_via?:int|null,
     *     freight_cost?:float,
     *     cost_center_id?:int,
     *     cost_center2_id?:int,
     *     comments?:string|null,
     *     close_order?:bool,
     *     reference?:string|null,
     *     lines: array<int, array{sales_order_detail_id:int, quantity:float}>
     * }  $payload
     * @return array{trans_no:int, trans_type:int, reference:string, debtor_trans: array<string, mixed>, gl_warning?:string|null}
     */
    public function dispatch(array $payload): array
    {
        return DB::transaction(function () use ($payload) {
            $orderNo = (int) ($payload['order_no'] ?? 0);
            if ($orderNo <= 0) {
                throw new InvalidArgumentException('Sales order number is required.');
            }

            $order = DB::table('sales_orders')->where('order_no', $orderNo)->first();
            if (! $order) {
                throw new InvalidArgumentException("Sales order {$orderNo} not found.");
            }

            $fromStkLoc = trim((string) ($payload['from_stk_loc'] ?? ''));
            if ($fromStkLoc !== '' && $fromStkLoc !== (string) ($order->from_stk_loc ?? '')) {
                DB::table('sales_orders')
                    ->where('order_no', $orderNo)
                    ->update(['from_stk_loc' => $fromStkLoc, 'updated_at' => now()]);
                $order->from_stk_loc = $fromStkLoc;
            }

            $debtorNo = (int) $order->debtor_no;
            $branchCode = (int) $order->branch_code;
            $this->customerCredit->assertInvoicingAllowed($debtorNo);

            $branch = DB::table('cust_branch')->where('branch_code', $branchCode)->first();
            $taxGroupId = (int) ($branch->tax_group ?? 0);
            $salesType = DB::table('sales_types')->where('id', (int) ($order->order_type ?? 0))->first();
            $taxIncluded = (bool) ($salesType->taxIncl ?? $salesType->tax_incl ?? true);

            $inputLines = $payload['lines'] ?? [];
            if ($inputLines === []) {
                throw new InvalidArgumentException('At least one delivery line is required.');
            }

            $detailIds = array_map(fn ($l) => (int) ($l['sales_order_detail_id'] ?? 0), $inputLines);
            $soDetails = DB::table('sales_order_details')
                ->where('order_no', $orderNo)
                ->whereIn('id', $detailIds)
                ->get()
                ->keyBy('id');

            $calcLines = [];
            $dispatchLines = [];
            $stockRequirements = [];
            foreach ($inputLines as $idx => $input) {
                $detailId = (int) ($input['sales_order_detail_id'] ?? 0);
                $qty = round((float) ($input['quantity'] ?? 0), 4);
                if ($qty <= 0) {
                    continue;
                }

                $detail = $soDetails->get($detailId);
                if (! $detail) {
                    throw new InvalidArgumentException("Sales order line {$detailId} not found.");
                }

                $remaining = (float) $detail->quantity - (float) $detail->qty_sent;
                if ($qty > $remaining + 0.0001) {
                    throw new InvalidArgumentException(
                        "Delivery quantity for {$detail->stk_code} exceeds remaining order quantity."
                    );
                }

                $stock = $this->stockRow((string) $detail->stk_code);
                $locCode = (string) ($order->from_stk_loc ?? $branch->inventory_location ?? '');
                foreach (SalesKitExploder::stockLines((string) $detail->stk_code, $qty) as $stockLine) {
                    $component = $this->stockRow($stockLine['stock_id']);
                    if (! $this->shouldStockMove($component)) {
                        continue;
                    }
                    $key = strtoupper(trim($locCode)).'|'.$stockLine['stock_id'];
                    $stockRequirements[$key] = ($stockRequirements[$key] ?? 0) + (float) $stockLine['quantity'];
                }

                $calcLines[] = [
                    'stock_id' => (string) $detail->stk_code,
                    'quantity' => $qty,
                    'unit_price' => (float) $detail->unit_price,
                    'discount_percent' => (float) $detail->discount_percent,
                ];

                $dispatchLines[] = [
                    'detail' => $detail,
                    'quantity' => $qty,
                    'stock' => $stock,
                    'loc_code' => $locCode,
                    'calc_index' => count($calcLines) - 1,
                    'batch_id' => isset($input['batch_id']) && (int) $input['batch_id'] > 0 ? (int) $input['batch_id'] : null,
                ];
            }

            if ($dispatchLines === []) {
                throw new InvalidArgumentException('No delivery quantities to dispatch.');
            }

            foreach ($stockRequirements as $key => $requiredQty) {
                [$locCode, $stockId] = explode('|', $key, 2);
                $this->assertStockAvailable($this->stockRow($stockId), $locCode, $requiredQty);
            }

            $freightCost = round((float) ($payload['freight_cost'] ?? $order->freight_cost ?? 0), 2);
            $amounts = $this->taxCalculator->calculateDeliveryAmounts(
                $taxGroupId,
                $taxIncluded,
                $calcLines,
                $freightCost
            );

            $tranDate = (string) ($payload['tran_date'] ?? $order->ord_date ?? now()->toDateString());
            $dueDate = (string) ($payload['due_date'] ?? $order->delivery_date ?? $tranDate);
            $reference = trim((string) ($payload['reference'] ?? ''));
            if ($reference === '') {
                $refData = $this->references->next(self::TYPE_DELIVERY, $tranDate);
                $reference = (string) ($refData['reference'] ?? '');
                if ($reference === '') {
                    throw new InvalidArgumentException('Delivery reference is required.');
                }
            }

            $transNo = DebtorTransSequence::nextTransNo(self::TYPE_DELIVERY);
            $prepAmount = round((float) ($order->prep_amount ?? 0), 2);
            $isPrepaid = $prepAmount > 0.001;
            $exchangeRate = CustomerExchangeRate::forDebtor($debtorNo, $tranDate);

            $debtorTrans = DebtorTrans::query()->create([
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_DELIVERY,
                'version' => 0,
                'debtor_no' => $debtorNo,
                'branch_code' => $branchCode,
                'tran_date' => $tranDate,
                'due_date' => $dueDate,
                'reference' => $reference,
                'tpe' => (int) ($order->order_type ?? 0),
                'order_no' => $orderNo,
                'ov_amount' => $amounts['ov_amount'],
                'ov_gst' => $amounts['ov_gst'],
                'ov_freight' => $freightCost,
                'ov_freight_tax' => $amounts['ov_freight_tax'],
                'ov_discount' => 0,
                'alloc' => 0,
                'prep_amount' => $isPrepaid ? $prepAmount : 0,
                'rate' => $exchangeRate,
                'ship_via' => $this->resolveShipVia($payload['ship_via'] ?? null, $order->ship_via ?? null),
                'cost_center_id' => (int) ($payload['cost_center_id'] ?? 0),
                'cost_center2_id' => (int) ($payload['cost_center2_id'] ?? 0),
                'payment_terms' => $order->payment_terms,
                'tax_included' => $amounts['tax_included'],
            ]);

            foreach ($dispatchLines as $row) {
                /** @var object $detail */
                $detail = $row['detail'];
                $qty = (float) $row['quantity'];
                $stock = $row['stock'];
                $lineAmount = $amounts['line_amounts'][$row['calc_index']] ?? [
                    'unit_tax' => 0,
                    'line_net' => 0,
                    'line_tax' => 0,
                ];
                $standardCost = $this->unitCost($stock);
                $discountedUnit = (float) $detail->unit_price * (1 - (float) $detail->discount_percent / 100);
                $listUnit = (float) $detail->unit_price;

                DB::table('debtor_trans_details')->insert([
                    'debtor_trans_no' => $transNo,
                    'debtor_trans_type' => self::TYPE_DELIVERY,
                    'stock_id' => $detail->stk_code,
                    'description' => $detail->description,
                    'quantity' => $qty,
                    'unit_price' => round($listUnit, 4),
                    'unit_tax' => $lineAmount['unit_tax'],
                    'discount_percent' => (float) $detail->discount_percent,
                    'standard_cost' => $standardCost,
                    'qty_done' => 0,
                    'src_id' => (int) $detail->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('sales_order_details')
                    ->where('id', $detail->id)
                    ->update([
                        'qty_sent' => DB::raw('qty_sent + '.(float) $qty),
                        'updated_at' => now(),
                    ]);

                if ($this->shouldStockMove($stock)) {
                    foreach (SalesKitExploder::stockLines((string) $detail->stk_code, $qty) as $stockLine) {
                        $component = $this->stockRow($stockLine['stock_id']);
                        if (! $this->shouldStockMove($component)) {
                            continue;
                        }

                        $componentCost = $this->unitCost($component);
                        $move = [
                            'trans_no' => $transNo,
                            'stock_id' => $stockLine['stock_id'],
                            'type' => self::TYPE_DELIVERY,
                            'loc_code' => $row['loc_code'],
                            'tran_date' => $tranDate,
                            'reference' => $reference,
                            'qty' => -1 * (float) $stockLine['quantity'],
                            'standard_cost' => $componentCost,
                            'price' => round($discountedUnit, 4),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                        DB::table('stock_moves')->insert($move);
                        // Picked batch applies to the sold item itself, not to kit components.
                        $this->locStockQty->applyStockMoveRecord(
                            $move,
                            $stockLine['stock_id'] === (string) $detail->stk_code ? ['batch_id' => $row['batch_id'] ?? null] : []
                        );

                        if ((int) ($component->mb_flag ?? 0) === FaDepreciationService::FA_MB_FLAG) {
                            DB::table('stock_master')
                                ->where('stock_id', $stockLine['stock_id'])
                                ->update(['inactive' => 1, 'material_cost' => 0, 'updated_at' => now()]);
                        }
                    }
                }
            }

            $this->persistTaxDetails($transNo, $tranDate, $reference, $amounts);
            $this->addComment(self::TYPE_DELIVERY, $transNo, $tranDate, (string) ($payload['comments'] ?? ''));
            $this->addAuditTrail(self::TYPE_DELIVERY, $transNo, $tranDate, 'Created');
            $this->bumpSalesOrderVersion($orderNo);

            if (! empty($payload['close_order'])) {
                DB::table('sales_orders')->where('order_no', $orderNo)->update(['updated_at' => now()]);
            }

            $glWarning = null;
            $run = GlPostingRunner::run(fn () => $this->postings->repostDebtorTrans($debtorTrans->fresh()));
            $glWarning = $run['gl_warning'];

            $result = [
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_DELIVERY,
                'reference' => $reference,
                'debtor_trans' => $debtorTrans->fresh()->toArray(),
            ];
            if ($glWarning) {
                $result['gl_warning'] = $glWarning;
            }

            return $result;
        });
    }

    /**
     * FrontAccounting void_sales_delivery() equivalent.
     */
    public function void(int $transNo, ?string $memo = null): array
    {
        return DB::transaction(function () use ($transNo, $memo) {
            $header = DebtorTrans::query()
                ->where('trans_type', self::TYPE_DELIVERY)
                ->where('trans_no', $transNo)
                ->first();

            if (! $header) {
                throw new InvalidArgumentException('Delivery note not found.');
            }

            $details = DB::table('debtor_trans_details')
                ->where('debtor_trans_type', self::TYPE_DELIVERY)
                ->where('debtor_trans_no', $transNo)
                ->get();

            foreach ($details as $detail) {
                if ((int) ($detail->src_id ?? 0) > 0) {
                    DB::table('sales_order_details')
                        ->where('id', $detail->src_id)
                        ->update([
                            'qty_sent' => DB::raw('GREATEST(0, qty_sent - '.(float) $detail->quantity.')'),
                            'updated_at' => now(),
                        ]);
                }
            }

            if (Schema::hasTable('stock_moves')) {
                $moves = DB::table('stock_moves')
                    ->where('type', self::TYPE_DELIVERY)
                    ->where('trans_no', $transNo)
                    ->get();
                foreach ($moves as $move) {
                    // Put the stock back into the batches this delivery took it from.
                    $this->locStockQty->applyMoveDelta(
                        (string) $move->stock_id,
                        (string) $move->loc_code,
                        -1 * (float) $move->qty,
                        ['restore_from' => ['type' => self::TYPE_DELIVERY, 'no' => $transNo], 'trans_type' => self::TYPE_DELIVERY, 'trans_no' => $transNo, 'note' => 'Delivery void']
                    );
                }
                DB::table('stock_moves')
                    ->where('type', self::TYPE_DELIVERY)
                    ->where('trans_no', $transNo)
                    ->delete();
            }

            if (Schema::hasTable('trans_tax_details')) {
                DB::table('trans_tax_details')
                    ->where('trans_type', self::TYPE_DELIVERY)
                    ->where('trans_no', $transNo)
                    ->delete();
            }

            if (Schema::hasTable('cust_allocations')) {
                DB::table('cust_allocations')
                    ->where(function ($q) use ($transNo) {
                        $q->where(function ($q2) use ($transNo) {
                            $q2->where('trans_type_from', self::TYPE_DELIVERY)
                                ->where('trans_no_from', $transNo);
                        })->orWhere(function ($q2) use ($transNo) {
                            $q2->where('trans_type_to', self::TYPE_DELIVERY)
                                ->where('trans_no_to', $transNo);
                        });
                    })
                    ->delete();
            }

            GlTransHelper::deletePosted(self::TYPE_DELIVERY, $transNo);

            DB::table('debtor_trans_details')
                ->where('debtor_trans_type', self::TYPE_DELIVERY)
                ->where('debtor_trans_no', $transNo)
                ->delete();

            $header->delete();

            $this->addAuditTrail(self::TYPE_DELIVERY, $transNo, now()->toDateString(), 'Voided');
            if ($memo) {
                $this->addComment(self::TYPE_DELIVERY, $transNo, now()->toDateString(), $memo);
            }

            return [
                'message' => 'Delivery note voided.',
                'trans_type' => self::TYPE_DELIVERY,
                'trans_no' => $transNo,
            ];
        });
    }

    private function stockRow(string $stockId): ?object
    {
        if ($stockId === '' || ! Schema::hasTable('stock_master')) {
            return null;
        }

        return DB::table('stock_master')->where('stock_id', $stockId)->first();
    }

    private function resolveShipVia(mixed $payloadShipVia, mixed $orderShipVia): ?int
    {
        $candidate = (int) ($payloadShipVia ?? $orderShipVia ?? 0);
        if ($candidate <= 0) {
            return null;
        }
        if (Schema::hasTable('shipping_companies')) {
            $exists = DB::table('shipping_companies')->where('shipper_id', $candidate)->exists();
            if (! $exists) {
                return null;
            }
        }

        return $candidate;
    }

    private function unitCost(?object $stock): float
    {
        if (! $stock) {
            return 0.0;
        }

        $material = (float) ($stock->material_cost ?? 0);
        if ($material > 0) {
            return $material;
        }

        return (float) ($stock->purchase_cost ?? 0);
    }

    private function shouldStockMove(?object $stock): bool
    {
        if (! $stock) {
            return false;
        }

        return (int) ($stock->mb_flag ?? 0) !== self::SERVICE_MB_FLAG;
    }

    private function assertStockAvailable(?object $stock, string $locCode, float $qty): void
    {
        if (
            InventoryPreferences::allowNegativeInventory()
            || ! $this->shouldStockMove($stock)
            || $locCode === ''
            || ! Schema::hasTable('loc_stock')
        ) {
            return;
        }

        $onHand = (float) (DB::table('loc_stock')
            ->where('loc_code', $locCode)
            ->where('stock_id', $stock->stock_id)
            ->value('quantity') ?? 0);

        if ($onHand + 1e-6 < $qty) {
            throw new InvalidArgumentException(sprintf(
                'Insufficient stock for %s at %s. On hand: %s, required: %s.',
                $stock->stock_id,
                $locCode,
                number_format($onHand, 2, '.', ''),
                number_format($qty, 2, '.', '')
            ));
        }
    }

    /**
     * @param  array<string, mixed>  $amounts
     */
    private function persistTaxDetails(int $transNo, string $tranDate, string $reference, array $amounts): void
    {
        if (! Schema::hasTable('trans_tax_details')) {
            return;
        }

        foreach ($amounts['tax_details'] ?? [] as $tax) {
            if (abs((float) ($tax['amount'] ?? 0)) < 0.001) {
                continue;
            }

            DB::table('trans_tax_details')->insert([
                'trans_type' => self::TYPE_DELIVERY,
                'trans_no' => $transNo,
                'tran_date' => $tranDate,
                'tax_type_id' => (int) $tax['tax_type_id'],
                'rate' => (float) $tax['rate'],
                'ex_rate' => 1,
                'included_in_price' => (bool) ($amounts['tax_included'] ?? false),
                'net_amount' => (float) $tax['net_amount'],
                'amount' => (float) $tax['amount'],
                'memo' => $reference,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function addComment(int $type, int $transNo, string $date, string $memo): void
    {
        if ($memo === '' || ! Schema::hasTable('comments')) {
            return;
        }

        DB::table('comments')->insert([
            'type' => $type,
            'id' => $transNo,
            'date_' => $date,
            'memo_' => $memo,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function addAuditTrail(int $type, int $transNo, string $glDate, string $description): void
    {
        if (! Schema::hasTable('audit_trail')) {
            return;
        }

        $range = ActiveFiscalYear::range($glDate);
        DB::table('audit_trail')->insert([
            'type' => $type,
            'trans_no' => $transNo,
            'user' => (int) (Auth::id() ?? 0),
            'description' => substr($description, 0, 60),
            'fiscal_year' => (int) ($range['id'] ?? 0),
            'gl_date' => $glDate,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function bumpSalesOrderVersion(int $orderNo): void
    {
        if (! Schema::hasTable('sales_orders') || ! Schema::hasColumn('sales_orders', 'version')) {
            return;
        }

        DB::table('sales_orders')
            ->where('order_no', $orderNo)
            ->update(['version' => DB::raw('version + 1'), 'updated_at' => now()]);
    }

    /**
     * FrontAccounting direct delivery: auto SO (reference=auto) + write_sales_delivery().
     *
     * @param  array{
     *     debtor_no:int,
     *     branch_code:int,
     *     tran_date:string,
     *     due_date?:string|null,
     *     order_type:int,
     *     ship_via?:int|null,
     *     payment_terms?:int|null,
     *     freight_cost?:float,
     *     from_stk_loc:string,
     *     cost_center_id?:int,
     *     cost_center2_id?:int,
     *     comments?:string|null,
     *     reference?:string|null,
     *     customer_ref?:string|null,
     *     delivery_address?:string|null,
     *     deliver_to?:string|null,
     *     lines: array<int, array{stock_id:string, quantity:float, unit_price:float, discount_percent?:float, description?:string|null}>
     * }  $payload
     */
    public function dispatchDirect(array $payload): array
    {
        return DB::transaction(function () use ($payload) {
            $orderNo = $this->createAutoSalesOrderForDirect($payload);
            $lines = [];
            $soDetails = DB::table('sales_order_details')->where('order_no', $orderNo)->get();
            foreach ($soDetails as $detail) {
                $lines[] = [
                    'sales_order_detail_id' => (int) $detail->id,
                    'quantity' => (float) $detail->quantity,
                ];
            }

            return $this->dispatch(array_merge($payload, [
                'order_no' => $orderNo,
                'lines' => $lines,
            ]));
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function createAutoSalesOrderForDirect(array $payload): int
    {
        $inputLines = $payload['lines'] ?? [];
        if ($inputLines === []) {
            throw new InvalidArgumentException('At least one delivery line is required.');
        }

        $orderNo = max(1, (int) DB::table('sales_orders')->lockForUpdate()->max('order_no') + 1);
        $total = 0.0;
        foreach ($inputLines as $line) {
            $qty = (float) ($line['quantity'] ?? 0);
            $price = (float) ($line['unit_price'] ?? 0);
            $disc = (float) ($line['discount_percent'] ?? 0);
            $total += $qty * $price * (1 - $disc / 100);
        }
        $total += round((float) ($payload['freight_cost'] ?? 0), 2);

        $orderType = (int) ($payload['order_type'] ?? 0);
        if ($orderType <= 0 || ! DB::table('sales_types')->where('id', $orderType)->exists()) {
            throw new InvalidArgumentException('Invalid or missing price list (sales type). Please select a valid price list.');
        }

        DB::table('sales_orders')->insert([
            'order_no' => $orderNo,
            'trans_type' => 30,
            'version' => 0,
            'type' => 0,
            'debtor_no' => (int) $payload['debtor_no'],
            'branch_code' => (int) $payload['branch_code'],
            'reference' => 'auto',
            'customer_ref' => $payload['customer_ref'] ?? '',
            'comments' => $payload['comments'] ?? '',
            'ord_date' => $payload['tran_date'] ?? now()->toDateString(),
            'order_type' => (int) ($payload['order_type'] ?? 0),
            'ship_via' => (int) ($payload['ship_via'] ?? 1),
            'delivery_address' => $payload['delivery_address'] ?? '',
            'deliver_to' => $payload['deliver_to'] ?? '',
            'freight_cost' => round((float) ($payload['freight_cost'] ?? 0), 2),
            'from_stk_loc' => (string) ($payload['from_stk_loc'] ?? ''),
            'delivery_date' => $payload['due_date'] ?? $payload['tran_date'] ?? now()->toDateString(),
            'payment_terms' => $payload['payment_terms'] ?? null,
            'total' => round($total, 2),
            'prep_amount' => 0,
            'alloc' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($inputLines as $line) {
            $qty = round((float) ($line['quantity'] ?? 0), 4);
            if ($qty <= 0) {
                continue;
            }
            DB::table('sales_order_details')->insert([
                'order_no' => $orderNo,
                'trans_type' => 30,
                'stk_code' => (string) ($line['stock_id'] ?? ''),
                'description' => $line['description'] ?? DB::table('stock_master')->where('stock_id', $line['stock_id'])->value('description') ?? '',
                'quantity' => $qty,
                'unit_price' => (float) ($line['unit_price'] ?? 0),
                'discount_percent' => (float) ($line['discount_percent'] ?? 0),
                'qty_sent' => 0,
                'invoiced' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $orderNo;
    }

    /** FrontAccounting template delivery — clone template SO lines into direct dispatch. */
    public function dispatchFromTemplate(int $templateOrderNo, array $overrides = []): array
    {
        $template = DB::table('sales_orders')->where('order_no', $templateOrderNo)->first();
        if (! $template || (int) ($template->type ?? 0) !== 1) {
            throw new InvalidArgumentException('Template sales order not found.');
        }

        $details = DB::table('sales_order_details')->where('order_no', $templateOrderNo)->get();
        if ($details->isEmpty()) {
            throw new InvalidArgumentException('Template order has no lines.');
        }

        $branch = DB::table('cust_branch')->where('branch_code', (int) $template->branch_code)->first();
        $fromStkLoc = trim((string) ($template->from_stk_loc ?? ''));
        if ($fromStkLoc === '' && $branch) {
            $fromStkLoc = trim((string) ($branch->inventory_location ?? ''));
        }
        if ($fromStkLoc === '') {
            throw new InvalidArgumentException('Template order has no deliver-from location. Set location on the order or branch.');
        }

        $lines = $details->map(fn ($d) => [
            'stock_id' => (string) $d->stk_code,
            'quantity' => (float) $d->quantity,
            'unit_price' => (float) $d->unit_price,
            'discount_percent' => (float) ($d->discount_percent ?? 0),
            'description' => $d->description,
        ])->all();

        $shipVia = $this->resolveShipVia($overrides['ship_via'] ?? null, $template->ship_via ?? null) ?? 1;

        return $this->dispatchDirect(array_merge([
            'debtor_no' => (int) $template->debtor_no,
            'branch_code' => (int) $template->branch_code,
            'tran_date' => $overrides['tran_date'] ?? now()->toDateString(),
            'due_date' => $overrides['due_date'] ?? $template->delivery_date,
            'order_type' => (int) ($template->order_type ?? 0),
            'ship_via' => $shipVia,
            'payment_terms' => $template->payment_terms,
            'freight_cost' => (float) ($template->freight_cost ?? 0),
            'from_stk_loc' => $fromStkLoc,
            'customer_ref' => $template->customer_ref ?? '',
            'delivery_address' => $template->delivery_address ?? '',
            'deliver_to' => $template->deliver_to ?? '',
            'lines' => $lines,
        ], $overrides));
    }

    public function updatePosted(int $transNo, array $payload): array
    {
        return app(SalesTransactionEditService::class)->updateDebtorDocument(self::TYPE_DELIVERY, $transNo, $payload);
    }
}
