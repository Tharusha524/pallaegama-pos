<?php

namespace App\Services\Sales;

use App\Models\DebtorTrans;
use App\Services\Accounting\AllocationService;
use App\Services\Accounting\PostingsService;
use App\Services\FiscalYear\TransactionReferenceService;
use App\Services\Inventory\LocStockQuantityService;
use App\Support\ActiveFiscalYear;
use App\Support\CustomerExchangeRate;
use App\Support\SalesKitExploder;
use App\Support\DebtorTransSequence;
use App\Support\GlPostingRunner;
use App\Support\GlTransHelper;
use App\Support\SalesTaxCalculator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

class SalesCreditNoteService
{
    public const TYPE_CREDIT = 11;

    public function __construct(
        private CustomerCreditService $customerCredit,
        private TransactionReferenceService $references,
        private SalesTaxCalculator $taxCalculator,
        private LocStockQuantityService $locStockQty,
        private PostingsService $postings,
        private AllocationService $allocations,
    ) {}

    /**
     * FrontAccounting write_credit_note() — Return (stock+) or WriteOff.
     *
     * @param  array{
     *     debtor_no:int,
     *     branch_code:int,
     *     tran_date:string,
     *     order_type:int,
     *     ship_via?:int|null,
     *     freight_cost?:float,
     *     from_stk_loc?:string,
     *     write_off_account?:string|null,
     *     source_invoice_trans_no?:int|null,
     *     comments?:string|null,
     *     reference?:string|null,
     *     lines: array<int, array{stock_id:string, quantity:float, unit_price:float, discount_percent?:float, description?:string|null, src_id?:int|null}>
     * }  $payload
     */
    public function create(array $payload): array
    {
        return DB::transaction(function () use ($payload) {
            $debtorNo = (int) ($payload['debtor_no'] ?? 0);
            $branchCode = (int) ($payload['branch_code'] ?? 0);
            $this->customerCredit->assertInvoicingAllowed($debtorNo);

            $lines = $payload['lines'] ?? [];
            if ($lines === []) {
                throw new InvalidArgumentException('At least one credit line is required.');
            }

            $branch = DB::table('cust_branch')->where('branch_code', $branchCode)->first();
            $taxGroupId = (int) ($branch->tax_group ?? 0);
            $orderType = (int) ($payload['order_type'] ?? 0);
            $salesType = DB::table('sales_types')->where('id', $orderType)->first();
            $taxIncluded = (bool) ($salesType->taxIncl ?? $salesType->tax_incl ?? true);

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
                    'src_id' => $line['src_id'] ?? null,
                ];
            }

            if ($calcLines === []) {
                throw new InvalidArgumentException('No valid credit quantities.');
            }

            $freightCost = round((float) ($payload['freight_cost'] ?? 0), 2);
            $amounts = $this->taxCalculator->calculateDeliveryAmounts($taxGroupId, $taxIncluded, $calcLines, $freightCost);

            $tranDate = (string) ($payload['tran_date'] ?? now()->toDateString());
            $reference = trim((string) ($payload['reference'] ?? ''));
            if ($reference === '') {
                $refData = $this->references->next(self::TYPE_CREDIT, $tranDate);
                $reference = (string) ($refData['reference'] ?? '');
            }

            $transNo = DebtorTransSequence::nextTransNo(self::TYPE_CREDIT);
            $isReturn = empty($payload['write_off_account']);
            $writeOffAccount = trim((string) ($payload['write_off_account'] ?? ''));
            $locCode = (string) ($payload['from_stk_loc'] ?? $branch->default_location ?? '');

            $debtorTrans = DebtorTrans::query()->create([
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_CREDIT,
                'version' => 0,
                'debtor_no' => $debtorNo,
                'branch_code' => $branchCode,
                'tran_date' => $tranDate,
                'due_date' => $tranDate,
                'reference' => $reference,
                'tpe' => $orderType,
                'order_no' => 0,
                'ov_amount' => $amounts['ov_amount'],
                'ov_gst' => $amounts['ov_gst'],
                'ov_freight' => $freightCost,
                'ov_freight_tax' => $amounts['ov_freight_tax'],
                'ov_discount' => 0,
                'alloc' => 0,
                'prep_amount' => 0,
                'rate' => CustomerExchangeRate::forDebtor($debtorNo, $tranDate),
                'ship_via' => (int) ($payload['ship_via'] ?? 1),
                'cost_center_id' => (int) ($payload['cost_center_id'] ?? 0),
                'cost_center2_id' => 0,
                'payment_terms' => null,
                'tax_included' => $amounts['tax_included'],
                'write_off_account' => $writeOffAccount !== '' ? $writeOffAccount : null,
            ]);

            // Returned stock goes back into the batches the original sale took it from.
            $sourceDeliveryNo = $this->sourceDeliveryNo((int) ($payload['source_invoice_trans_no'] ?? $payload['return_of_invoice'] ?? 0));

            foreach ($calcLines as $idx => $line) {
                $stock = DB::table('stock_master')->where('stock_id', $line['stock_id'])->first();
                $standardCost = (float) ($stock->material_cost ?? $stock->purchase_cost ?? 0);
                $discountedUnit = $line['unit_price'] * (1 - $line['discount_percent'] / 100);
                $lineAmount = $amounts['line_amounts'][$idx] ?? ['unit_tax' => 0];

                DB::table('debtor_trans_details')->insert([
                    'debtor_trans_no' => $transNo,
                    'debtor_trans_type' => self::TYPE_CREDIT,
                    'stock_id' => $line['stock_id'],
                    'description' => $line['description'] ?? $stock->description ?? $line['stock_id'],
                    'quantity' => $line['quantity'],
                    'unit_price' => round((float) $line['unit_price'], 4),
                    'unit_tax' => $lineAmount['unit_tax'],
                    'discount_percent' => $line['discount_percent'],
                    'standard_cost' => $standardCost,
                    'qty_done' => 0,
                    'src_id' => (int) ($line['src_id'] ?? 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if ($isReturn && $locCode !== '') {
                    foreach (SalesKitExploder::stockLines($line['stock_id'], $line['quantity']) as $stockLine) {
                        $component = DB::table('stock_master')->where('stock_id', $stockLine['stock_id'])->first();
                        if (! $component || (int) ($component->mb_flag ?? 0) === 3) {
                            continue;
                        }

                        $componentCost = (float) ($component->material_cost ?? $component->purchase_cost ?? 0);
                        $move = [
                            'trans_no' => $transNo,
                            'stock_id' => $stockLine['stock_id'],
                            'type' => self::TYPE_CREDIT,
                            'loc_code' => $locCode,
                            'tran_date' => $tranDate,
                            'reference' => $reference,
                            'qty' => (float) $stockLine['quantity'],
                            'standard_cost' => $componentCost,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                        DB::table('stock_moves')->insert($move);
                        $this->locStockQty->applyStockMoveRecord($move, [
                            'restore_from' => $sourceDeliveryNo > 0 ? ['type' => 13, 'no' => $sourceDeliveryNo] : null,
                            'note' => 'Customer return',
                        ]);
                    }
                }
            }

            $this->persistTaxDetails($transNo, $tranDate, $reference, $amounts);
            $this->addComment(self::TYPE_CREDIT, $transNo, $tranDate, (string) ($payload['comments'] ?? ''));
            $this->addAuditTrail(self::TYPE_CREDIT, $transNo, $tranDate, 'Created');

            $sourceInvoice = (int) ($payload['source_invoice_trans_no'] ?? 0);
            if ($sourceInvoice > 0) {
                $docTotal = round(
                    $amounts['ov_amount'] + $amounts['ov_gst'] + $freightCost + $amounts['ov_freight_tax'],
                    2
                );
                $this->allocations->processCustomerAllocations($transNo, self::TYPE_CREDIT, $tranDate, [[
                    'trans_no_to' => $sourceInvoice,
                    'trans_type_to' => 10,
                    'amt' => $docTotal,
                ]]);
                $debtorTrans->refresh();
            }

            $glWarning = null;
            $run = GlPostingRunner::run(fn () => $this->postings->repostDebtorTrans($debtorTrans->fresh()));
            $glWarning = $run['gl_warning'];

            $result = [
                'trans_no' => $transNo,
                'trans_type' => self::TYPE_CREDIT,
                'reference' => $reference,
                'debtor_trans' => $debtorTrans->fresh()->toArray(),
            ];
            if ($glWarning) {
                $result['gl_warning'] = $glWarning;
            }

            return $result;
        });
    }

    /** Delivery note behind an invoice (POS sale / direct invoice), 0 if unknown. */
    private function sourceDeliveryNo(int $invoiceNo): int
    {
        if ($invoiceNo <= 0) {
            return 0;
        }

        return (int) DB::table('debtor_trans_details as inv')
            ->join('debtor_trans_details as dl', 'dl.id', '=', 'inv.src_id')
            ->where('inv.debtor_trans_type', 10)
            ->where('inv.debtor_trans_no', $invoiceNo)
            ->where('dl.debtor_trans_type', 13)
            ->value('dl.debtor_trans_no');
    }

    public function void(int $transNo, ?string $memo = null): array
    {
        return DB::transaction(function () use ($transNo, $memo) {
            $header = DebtorTrans::query()->where('trans_type', self::TYPE_CREDIT)->where('trans_no', $transNo)->first();
            if (! $header) {
                throw new InvalidArgumentException('Credit note not found.');
            }

            if (Schema::hasTable('stock_moves')) {
                $moves = DB::table('stock_moves')->where('type', self::TYPE_CREDIT)->where('trans_no', $transNo)->get();
                foreach ($moves as $move) {
                    $this->locStockQty->applyMoveDelta((string) $move->stock_id, (string) $move->loc_code, -1 * (float) $move->qty, [
                        'undo_of' => ['type' => self::TYPE_CREDIT, 'no' => $transNo],
                        'trans_type' => self::TYPE_CREDIT,
                        'trans_no' => $transNo,
                        'note' => 'Credit note void',
                    ]);
                }
                DB::table('stock_moves')->where('type', self::TYPE_CREDIT)->where('trans_no', $transNo)->delete();
            }

            if (Schema::hasTable('cust_allocations')) {
                DB::table('cust_allocations')->where(function ($q) use ($transNo) {
                    $q->where('trans_type_from', self::TYPE_CREDIT)->where('trans_no_from', $transNo)
                        ->orWhere('trans_type_to', self::TYPE_CREDIT)->where('trans_no_to', $transNo);
                })->delete();
            }

            GlTransHelper::deletePosted(self::TYPE_CREDIT, $transNo);
            DB::table('debtor_trans_details')->where('debtor_trans_type', self::TYPE_CREDIT)->where('debtor_trans_no', $transNo)->delete();
            $header->delete();

            return ['message' => 'Credit note voided.', 'trans_type' => self::TYPE_CREDIT, 'trans_no' => $transNo];
        });
    }

    /** @param  array<string, mixed>  $amounts */
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
                'trans_type' => self::TYPE_CREDIT, 'trans_no' => $transNo, 'tran_date' => $tranDate,
                'tax_type_id' => (int) $tax['tax_type_id'], 'rate' => (float) $tax['rate'], 'ex_rate' => 1,
                'included_in_price' => (bool) ($amounts['tax_included'] ?? false),
                'net_amount' => (float) $tax['net_amount'], 'amount' => (float) $tax['amount'],
                'memo' => $reference, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
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

    public function updatePosted(int $transNo, array $payload): array
    {
        return app(SalesTransactionEditService::class)->updateDebtorDocument(self::TYPE_CREDIT, $transNo, $payload);
    }
}
