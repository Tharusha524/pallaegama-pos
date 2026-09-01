<?php

namespace App\Services\Sales;

use App\Models\DebtorTrans;
use App\Services\Accounting\PostingsService;
use App\Services\FiscalYear\TransactionReferenceService;
use App\Support\ActiveFiscalYear;
use App\Support\CustomerExchangeRate;
use App\Support\DebtorTransSequence;
use App\Support\GlPostingRunner;
use App\Support\GlTransHelper;
use App\Support\SalesOrderPrepAmount;
use App\Support\SalesLinePricing;
use App\Support\SalesTaxCalculator;
use App\Support\ShipViaResolver;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

class SalesInvoiceService
{
    public const TYPE_INVOICE = 10;

    public const TYPE_PAYMENT = 12;

    public const TYPE_DELIVERY = 13;

    public const TYPE_ORDER = 30;

    public function __construct(
        private CustomerCreditService $customerCredit,
        private TransactionReferenceService $references,
        private SalesTaxCalculator $taxCalculator,
        private PostingsService $postings,
        private SalesDeliveryService $deliveryService,
    ) {
    }

    /**
     * FrontAccounting customer_invoice.php → write_sales_invoice() from delivery.
     *
     * @param  array{
     *     delivery_trans_no:int,
     *     tran_date:string,
     *     due_date?:string|null,
     *     ship_via?:int|null,
     *     freight_cost?:float,
     *     payment_terms?:int|null,
     *     comments?:string|null,
     *     reference?:string|null,
     *     lines: array<int, array{delivery_detail_id:int, quantity:float}>
     * }  $payload
     * @return array{trans_no:int, trans_type:int, reference:string, debtor_trans: array<string, mixed>, gl_warning?:string|null}
     */
    public function invoiceFromDelivery(array $payload): array
    {
        return DB::transaction(function () use ($payload) {
            $deliveryNo = (int) ($payload['delivery_trans_no'] ?? 0);
            if ($deliveryNo <= 0) {
                throw new InvalidArgumentException('Delivery transaction number is required.');
            }

            $delivery = DebtorTrans::query()
                ->where('trans_type', self::TYPE_DELIVERY)
                ->where('trans_no', $deliveryNo)
                ->first();

            if (!$delivery) {
                throw new InvalidArgumentException("Delivery note #{$deliveryNo} not found.");
            }

            $debtorNo = (int) $delivery->debtor_no;
            $this->customerCredit->assertInvoicingAllowed($debtorNo);

            $deliveryDetails = DB::table('debtor_trans_details')
                ->where('debtor_trans_type', self::TYPE_DELIVERY)
                ->where('debtor_trans_no', $deliveryNo)
                ->get()
                ->keyBy('id');

            $inputLines = $payload['lines'] ?? [];
            if ($inputLines === []) {
                throw new InvalidArgumentException('At least one invoice line is required.');
            }

            $branch = DB::table('cust_branch')->where('branch_code', (int) $delivery->branch_code)->first();
            $taxGroupId = (int) ($branch->tax_group ?? 0);
            $salesType = DB::table('sales_types')->where('id', (int) ($delivery->tpe ?? 0))->first();
            $taxIncluded = (bool) ($salesType->taxIncl ?? $salesType->tax_incl ?? true);

            $calcLines = [];
            $invoiceLines = [];
            foreach ($inputLines as $input) {
                $detailId = (int) ($input['delivery_detail_id'] ?? 0);
                $qty = round((float) ($input['quantity'] ?? 0), 4);
                if ($qty <= 0) {
                    continue;
                }

                $detail = $deliveryDetails->get($detailId);
                if (!$detail) {
                    throw new InvalidArgumentException("Delivery line {$detailId} not found.");
                }

                $remaining = (float) $detail->quantity - (float) $detail->qty_done;
                if ($qty > $remaining + 0.0001) {

                    throw new InvalidArgumentException(
                        "Invoice quantity for {$detail->stock_id} exceeds undelivered quantity on delivery."
                    );
                }

                $calcLines[] = [
                    'stock_id' => (string) $detail->stock_id,
                    'quantity' => $qty,
                    'unit_price' => SalesLinePricing::listUnitPrice($detail),
                    'discount_percent' => (float) ($detail->discount_percent ?? 0),
                ];

                $invoiceLines[] = ['detail' => $detail, 'quantity' => $qty, 'calc_index' => count($calcLines) - 1];
            }

            if ($invoiceLines === []) {
                throw new InvalidArgumentException('No invoice quantities to process.');
            }

            $freightCost = round((float) ($payload['freight_cost'] ?? $delivery->ov_freight ?? 0), 2);
            $amounts = $this->taxCalculator->calculateDeliveryAmounts(
                $taxGroupId,
                $taxIncluded,
                $calcLines,
                $freightCost
            );

            $documentTotal = round(
                $amounts['ov_amount'] + $amounts['ov_gst'] + $freightCost + $amounts['ov_freight_tax'],
                2
            );
            $this->customerCredit->assertCanExtendCredit($debtorNo, $documentTotal);

            $tranDate = (string) ($payload['tran_date'] ?? $delivery->tran_date ?? now()->toDateString());
            $dueDate = (string) ($payload['due_date'] ?? $delivery->due_date ?? $tranDate);
            $reference = trim((string) ($payload['reference'] ?? ''));
            if ($reference === '') {
                $refData = $this->references->next(self::TYPE_INVOICE, $tranDate);
                $reference = (string) ($refData['reference'] ?? '');
                if ($reference === '') {
                    throw new InvalidArgumentException('Invoice reference is required.');
                }
            }

            $transNo = DebtorTransSequence::nextTransNo(self::TYPE_INVOICE);
            $exchangeRate = CustomerExchangeRate::forDebtor($debtorNo, $tranDate);

            $debtorTrans = DebtorTrans::query()->create([
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_INVOICE,
                'version' => 0,
                'debtor_no' => $debtorNo,
                'branch_code' => (int) $delivery->branch_code,
                'tran_date' => $tranDate,
                'due_date' => $dueDate,
                'reference' => $reference,
                'tpe' => (int) ($delivery->tpe ?? 0),
                'order_no' => (int) ($delivery->order_no ?? 0),
                'ov_amount' => $amounts['ov_amount'],
                'ov_gst' => $amounts['ov_gst'],
                'ov_freight' => $freightCost,
                'ov_freight_tax' => $amounts['ov_freight_tax'],
                'ov_discount' => 0,
                'alloc' => 0,
                'prep_amount' => 0,
                'rate' => $exchangeRate,
                'ship_via' => ShipViaResolver::resolve($payload['ship_via'] ?? null, $delivery->ship_via ?? null),
                'cost_center_id' => $delivery->cost_center_id ?? null,
                'cost_center2_id' => $delivery->cost_center2_id ?? null,
                'payment_terms' => $payload['payment_terms'] ?? $delivery->payment_terms,
                'tax_included' => $amounts['tax_included'],
            ]);

            foreach ($invoiceLines as $row) {
                $detail = $row['detail'];
                $qty = (float) $row['quantity'];
                $lineAmount = $amounts['line_amounts'][$row['calc_index']] ?? ['unit_tax' => 0];
                $standardCost = (float) ($detail->standard_cost ?? 0);

                DB::table('debtor_trans_details')->insert([
                    'debtor_trans_no' => $transNo,
                    'debtor_trans_type' => self::TYPE_INVOICE,
                    'stock_id' => $detail->stock_id,
                    'description' => $detail->description,
                    'quantity' => $qty,
                    'unit_price' => SalesLinePricing::listUnitPrice($detail),
                    'unit_tax' => $lineAmount['unit_tax'],
                    'discount_percent' => (float) $detail->discount_percent,
                    'standard_cost' => $standardCost,
                    'qty_done' => 0,
                    'src_id' => (int) $detail->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('debtor_trans_details')
                    ->where('id', $detail->id)
                    ->update([
                        'qty_done' => DB::raw('qty_done + ' . (float) $qty),
                        'updated_at' => now(),
                    ]);
            }

            $this->persistTaxDetails($transNo, $tranDate, $reference, $amounts);
            $this->addComment(self::TYPE_INVOICE, $transNo, $tranDate, (string) ($payload['comments'] ?? ''));
            $this->addAuditTrail(self::TYPE_INVOICE, $transNo, $tranDate, 'Created');
            $this->bumpSalesOrderVersion((int) ($delivery->order_no ?? 0));

            $glWarning = null;
            $run = GlPostingRunner::run(fn() => $this->postings->repostDebtorTrans($debtorTrans->fresh()));
            $glWarning = $run['gl_warning'];

            $result = [
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_INVOICE,
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
     * FrontAccounting direct invoice: auto SO + implicit delivery + invoice (stock & COGS).
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
     *     from_stk_loc?:string,
     *     cost_center_id?:int,
     *     cost_center2_id?:int,
     *     comments?:string|null,
     *     reference?:string|null,
     *     customer_ref?:string|null,
     *     delivery_address?:string|null,
     *     deliver_to?:string|null,
     *     cash_sale?:bool,
     *     bank_account_id?:int|null,
     *     lines: array<int, array{stock_id:string, quantity:float, unit_price:float, discount_percent?:float, description?:string|null}>
     * }  $payload
     */
    public function directInvoice(array $payload): array
    {
        return DB::transaction(function () use ($payload) {
            $debtorNo = (int) ($payload['debtor_no'] ?? 0);
            $branchCode = (int) ($payload['branch_code'] ?? 0);
            if ($debtorNo <= 0 || $branchCode <= 0) {
                throw new InvalidArgumentException('Customer and branch are required.');
            }

            $this->customerCredit->assertInvoicingAllowed($debtorNo);

            $lines = $payload['lines'] ?? [];
            if ($lines === []) {
                throw new InvalidArgumentException('At least one line is required.');
            }

            $branch = DB::table('cust_branch')->where('branch_code', $branchCode)->first();
            if (!$branch) {
                throw new InvalidArgumentException('Customer branch not found.');
            }

            $orderType = (int) ($payload['order_type'] ?? 0);
            $salesType = DB::table('sales_types')->where('id', $orderType)->first();
            if (!$salesType) {
                throw new InvalidArgumentException('Invalid or missing price list (sales type). Please select a valid price list.');
            }
            $taxIncluded = (bool) ($salesType->taxIncl ?? $salesType->tax_incl ?? true);
            $taxGroupId = (int) ($branch->tax_group ?? 0);

            $calcLines = [];
            foreach ($lines as $line) {
                $qty = round((float) ($line['quantity'] ?? 0), 4);
                if ($qty <= 0) {
                    continue;
                }
                $calcLines[] = [
                    'stock_id' => (string) ($line['stock_id'] ?? ''),
                    'quantity' => $qty,
                    'unit_price' => (float) ($line['unit_price'] ?? 0),
                    'discount_percent' => (float) ($line['discount_percent'] ?? 0),
                    'description' => $line['description'] ?? null,
                ];
            }

            if ($calcLines === []) {
                throw new InvalidArgumentException('No valid line quantities.');
            }

            $freightCost = round((float) ($payload['freight_cost'] ?? 0), 2);
            $amounts = $this->taxCalculator->calculateDeliveryAmounts(
                $taxGroupId,
                $taxIncluded,
                $calcLines,
                $freightCost
            );

            $documentTotal = round(
                $amounts['ov_amount'] + $amounts['ov_gst'] + $freightCost + $amounts['ov_freight_tax'],
                2
            );

            $isCashSale = (bool) ($payload['cash_sale'] ?? false);
            if (!$isCashSale) {
                $this->customerCredit->assertCanExtendCredit($debtorNo, $documentTotal);
            }

            $tranDate = (string) ($payload['tran_date'] ?? now()->toDateString());
            $dueDate = (string) ($payload['due_date'] ?? $tranDate);

            $fromStkLoc = trim((string) ($payload['from_stk_loc'] ?? ''));
            if ($fromStkLoc === '') {
                $fromStkLoc = trim((string) ($branch->default_location ?? $branch->inventory_location ?? ''));
            }

            $orderNo = $this->createAutoSalesOrder($payload, $calcLines, $amounts, $documentTotal);

            $soDetails = DB::table('sales_order_details')->where('order_no', $orderNo)->get();
            $deliveryLines = $soDetails->map(fn($detail) => [
                'sales_order_detail_id' => (int) $detail->id,
                'quantity' => (float) $detail->quantity,
            ])->all();

            $deliveryResult = $this->deliveryService->dispatch([
                'order_no' => $orderNo,
                'tran_date' => $tranDate,
                'due_date' => $dueDate,
                'from_stk_loc' => $fromStkLoc,
                'freight_cost' => $freightCost,
                'ship_via' => ShipViaResolver::resolve($payload['ship_via'] ?? null),
                'cost_center_id' => $payload['cost_center_id'] ?? null,
                'cost_center2_id' => $payload['cost_center2_id'] ?? null,
                'comments' => (string) ($payload['comments'] ?? ''),
                'close_order' => true,
                'lines' => $deliveryLines,
            ]);

            $deliveryNo = (int) ($deliveryResult['trans_no'] ?? 0);
            $deliveryDetails = DB::table('debtor_trans_details')
                ->where('debtor_trans_type', self::TYPE_DELIVERY)
                ->where('debtor_trans_no', $deliveryNo)
                ->get();

            $invoiceLines = $deliveryDetails->map(fn($detail) => [
                'delivery_detail_id' => (int) $detail->id,
                'quantity' => (float) $detail->quantity,
            ])->all();

            $invoiceResult = $this->invoiceFromDelivery([
                'delivery_trans_no' => $deliveryNo,
                'tran_date' => $tranDate,
                'due_date' => $dueDate,
                'ship_via' => ShipViaResolver::resolve($payload['ship_via'] ?? null),
                'freight_cost' => $freightCost,
                'payment_terms' => $payload['payment_terms'] ?? null,
                'comments' => (string) ($payload['comments'] ?? ''),
                'reference' => $payload['reference'] ?? null,
                'lines' => $invoiceLines,
            ]);

            $transNo = (int) ($invoiceResult['trans_no'] ?? 0);
            $paymentTransNo = null;
            $paymentTransNos = [];
            if ($isCashSale && $documentTotal > 0.001 && $transNo > 0) {
                // Split payments (multiple methods on one sale): if the caller
                // supplies a 'payments' array, create one payment record per
                // line via the same accounting path used below — purely
                // additive, the original single bank_account_id flow is
                // untouched for callers that don't send 'payments'.
                $paidTotal = $documentTotal;
                if (!empty($payload['payments']) && is_array($payload['payments'])) {
                    $paidTotal = 0.0;
                    foreach ($payload['payments'] as $line) {
                        $lineAmount = round((float) ($line['amount'] ?? 0), 2);
                        if ($lineAmount <= 0.001) {
                            continue;
                        }
                        $paymentTransNos[] = $this->createCashSalePayment(
                            $debtorNo,
                            $branchCode,
                            $tranDate,
                            $lineAmount,
                            $transNo,
                            (int) ($line['bank_account_id'] ?? 0)
                        );
                        $paidTotal += $lineAmount;
                    }
                    $paymentTransNo = $paymentTransNos[0] ?? null;
                } else {
                    $paymentTransNo = $this->createCashSalePayment(
                        $debtorNo,
                        $branchCode,
                        $tranDate,
                        $documentTotal,
                        $transNo,
                        (int) ($payload['bank_account_id'] ?? 0)
                    );
                    $paymentTransNos[] = $paymentTransNo;
                }
                DebtorTrans::query()
                    ->where('trans_type', self::TYPE_INVOICE)
                    ->where('trans_no', $transNo)
                    ->update(['alloc' => $paidTotal]);
            }

            $result = array_merge($invoiceResult, [
                'order_no' => $orderNo,
                'delivery_trans_no' => $deliveryNo,
                'delivery_reference' => $deliveryResult['reference'] ?? null,
            ]);
            if ($paymentTransNo) {
                $result['payment_trans_no'] = $paymentTransNo;
                $result['payment_trans_nos'] = $paymentTransNos;
            }

            return $result;
        });
    }

    /**
     * FrontAccounting void_sales_invoice() — reverse delivery qty_done and GL.
     */
    public function void(int $transNo, ?string $memo = null): array
    {
        return DB::transaction(function () use ($transNo, $memo) {
            $header = DebtorTrans::query()
                ->where('trans_type', self::TYPE_INVOICE)
                ->where('trans_no', $transNo)
                ->first();

            if (!$header) {
                throw new InvalidArgumentException('Sales invoice not found.');
            }

            $details = DB::table('debtor_trans_details')
                ->where('debtor_trans_type', self::TYPE_INVOICE)
                ->where('debtor_trans_no', $transNo)
                ->get();

            foreach ($details as $detail) {
                if ((int) ($detail->src_id ?? 0) > 0) {
                    DB::table('debtor_trans_details')
                        ->where('id', $detail->src_id)
                        ->where('debtor_trans_type', self::TYPE_DELIVERY)
                        ->update([
                            'qty_done' => DB::raw('GREATEST(0, qty_done - ' . (float) $detail->quantity . ')'),
                            'updated_at' => now(),
                        ]);
                }
            }

            if (Schema::hasTable('cust_allocations')) {
                DB::table('cust_allocations')
                    ->where(function ($q) use ($transNo) {
                        $q->where(function ($q2) use ($transNo) {
                            $q2->where('trans_type_from', self::TYPE_INVOICE)
                                ->where('trans_no_from', $transNo);
                        })->orWhere(function ($q2) use ($transNo) {
                            $q2->where('trans_type_to', self::TYPE_INVOICE)
                                ->where('trans_no_to', $transNo);
                        });
                    })
                    ->delete();
            }

            GlTransHelper::deletePosted(self::TYPE_INVOICE, $transNo);

            if (Schema::hasTable('trans_tax_details')) {
                DB::table('trans_tax_details')
                    ->where('trans_type', self::TYPE_INVOICE)
                    ->where('trans_no', $transNo)
                    ->delete();
            }

            DB::table('debtor_trans_details')
                ->where('debtor_trans_type', self::TYPE_INVOICE)
                ->where('debtor_trans_no', $transNo)
                ->delete();

            $header->delete();

            $this->voidLinkedAutoDeliveries($details, (int) ($header->order_no ?? 0));

            $this->addAuditTrail(self::TYPE_INVOICE, $transNo, now()->toDateString(), 'Voided');
            if ($memo) {
                $this->addComment(self::TYPE_INVOICE, $transNo, now()->toDateString(), $memo);
            }

            return [
                'message' => 'Sales invoice voided.',
                'trans_type' => self::TYPE_INVOICE,
                'trans_no' => $transNo,
            ];
        });
    }

    /**
     * @param  array<int, array{stock_id:string, quantity:float, unit_price:float, discount_percent:float}>  $calcLines
     */
    private function createAutoSalesOrder(array $payload, array $calcLines, array $amounts, float $documentTotal): int
    {
        $orderNo = max(1, (int) DB::table('sales_orders')->lockForUpdate()->max('order_no') + 1);

        $orderType = (int) ($payload['order_type'] ?? 0);
        if ($orderType <= 0 || !DB::table('sales_types')->where('id', $orderType)->exists()) {
            throw new InvalidArgumentException('Invalid or missing price list (sales type). Please select a valid price list.');
        }

        DB::table('sales_orders')->insert([
            'order_no' => $orderNo,
            'trans_type' => self::TYPE_ORDER,
            'version' => 0,
            'type' => 0,
            'debtor_no' => (int) $payload['debtor_no'],
            'branch_code' => (int) $payload['branch_code'],
            'reference' => 'auto',
            'customer_ref' => $payload['customer_ref'] ?? '',
            'comments' => $payload['comments'] ?? '',
            'ord_date' => $payload['tran_date'] ?? now()->toDateString(),
            'order_type' => (int) ($payload['order_type'] ?? 0),
            'ship_via' => ShipViaResolver::resolve($payload['ship_via'] ?? null),
            'delivery_address' => $payload['delivery_address'] ?? '',
            'deliver_to' => $payload['deliver_to'] ?? '',
            'freight_cost' => round((float) ($payload['freight_cost'] ?? 0), 2),
            'from_stk_loc' => $payload['from_stk_loc'] ?? '',
            'delivery_date' => $payload['due_date'] ?? $payload['tran_date'] ?? now()->toDateString(),
            'payment_terms' => $payload['payment_terms'] ?? null,
            'total' => $documentTotal,
            'prep_amount' => 0,
            'alloc' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($calcLines as $line) {
            DB::table('sales_order_details')->insert([
                'order_no' => $orderNo,
                'trans_type' => self::TYPE_ORDER,
                'stk_code' => $line['stock_id'],
                'description' => DB::table('stock_master')->where('stock_id', $line['stock_id'])->value('description') ?? $line['stock_id'],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'discount_percent' => $line['discount_percent'],
                'qty_sent' => 0,
                'invoiced' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $orderNo;
    }

    private function createCashSalePayment(
        int $debtorNo,
        int $branchCode,
        string $tranDate,
        float $amount,
        int $invoiceTransNo,
        int $bankAccountId
    ): int {
        if ($bankAccountId <= 0) {
            throw new InvalidArgumentException('Bank account is required for cash sales.');
        }

        $paymentNo = DebtorTransSequence::nextTransNo(self::TYPE_PAYMENT);
        $refData = $this->references->next(self::TYPE_PAYMENT, $tranDate);
        $paymentRef = (string) ($refData['reference'] ?? 'PAY-' . $paymentNo);

        DebtorTrans::query()->create([
            'trans_no' => $paymentNo,
            'trans_type' => self::TYPE_PAYMENT,
            'version' => 0,
            'debtor_no' => $debtorNo,
            'branch_code' => $branchCode,
            'tran_date' => $tranDate,
            'due_date' => $tranDate,
            'reference' => $paymentRef,
            'tpe' => 0,
            'order_no' => 0,
            'ov_amount' => $amount,
            'ov_gst' => 0,
            'ov_freight' => 0,
            'ov_freight_tax' => 0,
            'ov_discount' => 0,
            'alloc' => $amount,
            'prep_amount' => 0,
            'rate' => CustomerExchangeRate::forDebtor($debtorNo, $tranDate),
            'ship_via' => null,
            // debtor_trans.cost_center_id/cost_center2_id are NOT NULL — send 0
            // (no cost center), never null, or this insert fails a DB constraint.
            'cost_center_id' => 0,
            'cost_center2_id' => 0,
            'payment_terms' => null,
            'tax_included' => 0,
        ]);

        if (Schema::hasTable('bank_trans')) {
            DB::table('bank_trans')->insert([
                'trans_no' => $paymentNo,
                'type' => self::TYPE_PAYMENT,
                'bank_act' => $bankAccountId,
                'ref' => $paymentRef,
                'trans_date' => $tranDate,
                'amount' => $amount,
                'person_type_id' => 2,
                'person_id' => $debtorNo,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $bankRow = (object) [
                'type' => self::TYPE_PAYMENT,
                'trans_no' => $paymentNo,
                'bank_act' => $bankAccountId,
                'ref' => $paymentRef,
                'trans_date' => $tranDate,
                'amount' => $amount,
            ];
            GlPostingRunner::run(fn() => $this->postings->repostBankPayment($bankRow));
        }

        if (Schema::hasTable('cust_allocations')) {
            DB::table('cust_allocations')->insert([
                'person_id' => $debtorNo,
                'amt' => $amount,
                'date_alloc' => $tranDate,
                'trans_no_from' => $paymentNo,
                'trans_type_from' => self::TYPE_PAYMENT,
                'trans_no_to' => $invoiceTransNo,
                'trans_type_to' => self::TYPE_INVOICE,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $paymentNo;
    }

    /**
     * @param  array<string, mixed>  $amounts
     */
    private function persistTaxDetails(int $transNo, string $tranDate, string $reference, array $amounts): void
    {
        if (!Schema::hasTable('trans_tax_details')) {
            return;
        }

        foreach ($amounts['tax_details'] ?? [] as $tax) {
            if (abs((float) ($tax['amount'] ?? 0)) < 0.001) {
                continue;
            }

            DB::table('trans_tax_details')->insert([
                'trans_type' => self::TYPE_INVOICE,
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
        if ($memo === '' || !Schema::hasTable('comments')) {
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
        if (!Schema::hasTable('audit_trail')) {
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
        if ($orderNo <= 0 || !Schema::hasTable('sales_orders') || !Schema::hasColumn('sales_orders', 'version')) {
            return;
        }

        DB::table('sales_orders')
            ->where('order_no', $orderNo)
            ->update(['version' => DB::raw('version + 1'), 'updated_at' => now()]);
    }

    /** FrontAccounting template invoice. */
    public function directInvoiceFromTemplate(int $templateOrderNo, array $overrides = []): array
    {
        $template = DB::table('sales_orders')->where('order_no', $templateOrderNo)->first();
        if (!$template || (int) ($template->type ?? 0) !== 1) {
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

        $lines = $details->map(fn($d) => [
            'stock_id' => (string) $d->stk_code,
            'quantity' => (float) $d->quantity,
            'unit_price' => (float) $d->unit_price,
            'discount_percent' => (float) ($d->discount_percent ?? 0),
            'description' => $d->description,
        ])->all();

        return $this->directInvoice(array_merge([
            'debtor_no' => (int) $template->debtor_no,
            'branch_code' => (int) $template->branch_code,
            'tran_date' => $overrides['tran_date'] ?? now()->toDateString(),
            'due_date' => $overrides['due_date'] ?? $template->delivery_date,
            'order_type' => (int) ($template->order_type ?? 0),
            'ship_via' => ShipViaResolver::resolve($overrides['ship_via'] ?? null, $template->ship_via ?? null),
            'payment_terms' => $template->payment_terms,
            'freight_cost' => (float) ($template->freight_cost ?? 0),
            'from_stk_loc' => $fromStkLoc,
            'customer_ref' => $template->customer_ref ?? '',
            'delivery_address' => $template->delivery_address ?? '',
            'deliver_to' => $template->deliver_to ?? '',
            'lines' => $lines,
        ], $overrides));
    }

    /** FrontAccounting final invoice for prepaid order (remainder after prepayment invoices). */
    public function prepaidFinalInvoice(int $orderNo, array $overrides = []): array
    {
        $order = DB::table('sales_orders')->where('order_no', $orderNo)->first();
        $prepRequired = SalesOrderPrepAmount::resolve($order ?? []);
        if (!$order || $prepRequired <= 0) {
            throw new InvalidArgumentException('Prepaid sales order not found.');
        }

        $allocated = (float) ($order->alloc ?? 0);
        if ($allocated + 0.01 < $prepRequired) {
            throw new InvalidArgumentException('Prepaid order is not fully paid. Cannot issue final invoice.');
        }

        // Persist computed prep_amount when legacy rows had 0.
        if ((float) ($order->prep_amount ?? 0) <= 0 && $prepRequired > 0) {
            DB::table('sales_orders')
                ->where('order_no', $orderNo)
                ->update(['prep_amount' => $prepRequired, 'updated_at' => now()]);
        }

        $details = DB::table('sales_order_details')->where('order_no', $orderNo)->get();
        $lines = $details->map(fn($d) => [
            'stock_id' => (string) $d->stk_code,
            'quantity' => (float) $d->quantity,
            'unit_price' => (float) $d->unit_price,
            'discount_percent' => (float) ($d->discount_percent ?? 0),
            'description' => $d->description,
        ])->all();

        return $this->directInvoice(array_merge([
            'debtor_no' => (int) $order->debtor_no,
            'branch_code' => (int) $order->branch_code,
            'tran_date' => $overrides['tran_date'] ?? now()->toDateString(),
            'due_date' => $overrides['due_date'] ?? $order->delivery_date,
            'order_type' => (int) ($order->order_type ?? 0),
            'ship_via' => ShipViaResolver::resolve($overrides['ship_via'] ?? null, $order->ship_via ?? null),
            'payment_terms' => $order->payment_terms,
            'freight_cost' => (float) ($order->freight_cost ?? 0),
            'from_stk_loc' => (string) ($order->from_stk_loc ?? ''),
            'comments' => $overrides['comments'] ?? 'Final prepaid invoice',
            'lines' => $lines,
        ], $overrides));
    }

    /**
     * @param  \Illuminate\Support\Collection<int, object>  $invoiceDetails
     */
    private function voidLinkedAutoDeliveries($invoiceDetails, int $orderNo): void
    {
        if ($orderNo <= 0) {
            return;
        }

        $orderRef = (string) (DB::table('sales_orders')->where('order_no', $orderNo)->value('reference') ?? '');
        if ($orderRef !== 'auto') {
            return;
        }

        $deliveryNos = [];
        foreach ($invoiceDetails as $detail) {
            $deliveryDetailId = (int) ($detail->src_id ?? 0);
            if ($deliveryDetailId <= 0) {
                continue;
            }
            $deliveryNo = (int) (DB::table('debtor_trans_details')
                ->where('id', $deliveryDetailId)
                ->where('debtor_trans_type', self::TYPE_DELIVERY)
                ->value('debtor_trans_no') ?? 0);
            if ($deliveryNo > 0) {
                $deliveryNos[$deliveryNo] = $deliveryNo;
            }
        }

        foreach ($deliveryNos as $deliveryNo) {
            try {
                $this->deliveryService->void($deliveryNo, 'Voided with direct invoice');
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }

    public function updatePosted(int $transNo, array $payload): array
    {
        return app(SalesTransactionEditService::class)->updateDebtorDocument(self::TYPE_INVOICE, $transNo, $payload);
    }
}
