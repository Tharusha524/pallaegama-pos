<?php

namespace App\Http\Controllers;

use App\Models\Voucher;
use App\Models\VoucherBatch;
use App\Models\VoucherRedemption;
use App\Services\Banking\BankingTransactionService;
use App\Services\Sales\SalesInvoiceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class VoucherController extends Controller
{
    private const VOUCHER_ITEM_ID = 'GIFTVOUCHER';
    private const VOUCHERS_PAYABLE_ACCOUNT = '2155';
    private const SALES_ACCOUNT = '2000';

    public function __construct(
        private SalesInvoiceService $invoiceService,
        private BankingTransactionService $bankingService,
    ) {}

    public function index(Request $request)
    {
        $query = Voucher::with('debtor:debtor_no,name', 'batch:id,batch_code')
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $s = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($s) {
                $q->where('voucher_code', 'like', $s)
                  ->orWhereHas('debtor', fn($d) => $d->where('name', 'like', $s)->orWhere('mobile', 'like', $s));
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->query('batch_id'));
        }

        return response()->json($query->get());
    }

    // Summary stats for top cards
    public function summary()
    {
        $today = now()->toDateString();
        $soon = now()->addDays(30)->toDateString();

        return response()->json([
            'total_cards'      => Voucher::count(),
            'active_balance'   => Voucher::whereIn('status', ['active', 'partially_used'])->sum('balance'),
            'redeemed_value'   => VoucherRedemption::sum('amount_used'),
            'expiring_soon'    => Voucher::whereIn('status', ['active', 'partially_used'])
                                         ->whereNotNull('expiry_date')
                                         ->whereBetween('expiry_date', [$today, $soon])
                                         ->count(),
        ]);
    }

    // List all batches with stats
    public function batches()
    {
        $batches = VoucherBatch::orderByDesc('id')->get()->map(function ($b) {
            $counts = Voucher::where('batch_id', $b->id)
                ->selectRaw("status, count(*) as cnt")
                ->groupBy('status')
                ->pluck('cnt', 'status');
            return array_merge($b->toArray(), [
                'stats' => [
                    'inactive'       => $counts['inactive'] ?? 0,
                    'active'         => $counts['active'] ?? 0,
                    'partially_used' => $counts['partially_used'] ?? 0,
                    'fully_used'     => $counts['fully_used'] ?? 0,
                    'expired'        => $counts['expired'] ?? 0,
                    'cancelled'      => $counts['cancelled'] ?? 0,
                ],
            ]);
        });

        return response()->json($batches);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'debtor_no'       => 'nullable|exists:debtors_master,debtor_no',
            'face_value'      => 'required|numeric|min:1',
            'expiry_date'     => 'nullable|date',
            'note'            => 'nullable|string',
            'branch_code'     => 'nullable|integer|exists:cust_branch,branch_code',
            'bank_account_id' => 'nullable|integer|exists:bank_accounts,id',
        ]);

        $data['voucher_code'] = 'GV-' . strtoupper(Str::random(10));
        $data['balance']      = $data['face_value'];
        $data['issue_date']   = now()->toDateString();
        $data['status']       = 'active'; // individual issued voucher → active immediately (sold at counter)
        $data['created_by']   = Auth::user()?->name ?? 'Admin';

        $canPostSale = !empty($data['debtor_no']) && !empty($data['branch_code']) && !empty($data['bank_account_id']);

        if (!$canPostSale) {
            unset($data['branch_code'], $data['bank_account_id']);
            return response()->json(Voucher::create($data)->load('debtor:debtor_no,name'), 201);
        }

        try {
            return DB::transaction(function () use ($data) {
                $invoiceResult = $this->invoiceService->directInvoice([
                    'debtor_no'       => $data['debtor_no'],
                    'branch_code'     => $data['branch_code'],
                    'order_type'      => $this->defaultSalesTypeId(),
                    'cash_sale'       => true,
                    'bank_account_id' => $data['bank_account_id'],
                    'tran_date'       => $data['issue_date'],
                    'ship_via'        => $this->defaultShipViaId(),
                    'from_stk_loc'    => $this->defaultStockLocation(),
                    'reference'       => 'Gift voucher ' . $data['voucher_code'],
                    'comments'        => $data['note'] ?? 'Gift voucher issued',
                    'lines'           => [[
                        'stock_id'   => self::VOUCHER_ITEM_ID,
                        'quantity'   => 1,
                        'unit_price' => $data['face_value'],
                    ]],
                ]);

                unset($data['branch_code'], $data['bank_account_id']);
                $data['issued_debtor_trans_no']   = $invoiceResult['trans_no'] ?? null;
                $data['issued_debtor_trans_type'] = $invoiceResult['trans_type'] ?? SalesInvoiceService::TYPE_INVOICE;

                $voucher = Voucher::create($data)->load('debtor:debtor_no,name');
                return response()->json(['voucher' => $voucher, 'invoice' => $invoiceResult], 201);
            });
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to post the voucher sale: ' . $e->getMessage()], 500);
        }
    }

    // Bulk generate gift cards (status = inactive)
    public function bulkGenerate(Request $request)
    {
        $data = $request->validate([
            'card_count'   => 'required|integer|min:1|max:1000',
            'face_value'   => 'required|numeric|min:1',
            'expiry_date'  => 'nullable|date',
            'note'         => 'nullable|string',
        ]);

        $createdBy = Auth::user()?->name ?? 'Admin';

        return DB::transaction(function () use ($data, $createdBy) {
            // Generate batch code GC-YYYY-NNN
            $year = now()->year;
            $lastBatch = VoucherBatch::where('batch_code', 'like', "GC-{$year}-%")->count();
            $batchCode = sprintf('GC-%d-%03d', $year, $lastBatch + 1);

            $batch = VoucherBatch::create([
                'batch_code'       => $batchCode,
                'card_count'       => $data['card_count'],
                'face_value_each'  => $data['face_value'],
                'total_face_value' => $data['card_count'] * $data['face_value'],
                'expiry_date'      => $data['expiry_date'] ?? null,
                'note'             => $data['note'] ?? null,
                'created_by'       => $createdBy,
            ]);

            $vouchers = [];
            for ($i = 1; $i <= $data['card_count']; $i++) {
                $code = 'GC-' . strtoupper(Str::random(8)) . '-' . str_pad($i, 4, '0', STR_PAD_LEFT);
                $vouchers[] = [
                    'batch_id'     => $batch->id,
                    'voucher_code' => $code,
                    'debtor_no'    => null,
                    'face_value'   => $data['face_value'],
                    'balance'      => $data['face_value'],
                    'issue_date'   => now()->toDateString(),
                    'expiry_date'  => $data['expiry_date'] ?? null,
                    'note'         => $data['note'] ?? null,
                    'status'       => 'inactive',
                    'created_by'   => $createdBy,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ];
            }

            // Insert in chunks to avoid query size limits
            foreach (array_chunk($vouchers, 100) as $chunk) {
                Voucher::insert($chunk);
            }

            return response()->json(['batch' => $batch, 'generated' => $data['card_count']], 201);
        });
    }

    // Activate a single gift card (customer paid for it)
    public function activate(Request $request, string $code)
    {
        $voucher = Voucher::where('voucher_code', $code)->firstOrFail();

        if ($voucher->status !== 'inactive') {
            return response()->json(['message' => 'Only inactive cards can be activated'], 422);
        }

        $data = $request->validate([
            'debtor_no' => 'nullable|exists:debtors_master,debtor_no',
        ]);

        $voucher->status       = 'active';
        $voucher->activated_at = now()->toDateString();
        $voucher->activated_by = Auth::user()?->name ?? 'Admin';
        if (!empty($data['debtor_no'])) {
            $voucher->debtor_no = $data['debtor_no'];
        }
        $voucher->save();

        return response()->json($voucher->load('debtor:debtor_no,name'));
    }

    // Cancel a voucher
    public function cancel(string $code)
    {
        $voucher = Voucher::where('voucher_code', $code)->firstOrFail();

        if (in_array($voucher->status, ['fully_used', 'cancelled'])) {
            return response()->json(['message' => 'Cannot cancel a fully used or already cancelled voucher'], 422);
        }

        $voucher->status = 'cancelled';
        $voucher->save();

        return response()->json($voucher);
    }

    public function show(string $code)
    {
        $voucher = Voucher::where('voucher_code', $code)
            ->with(['debtor:debtor_no,name', 'batch:id,batch_code', 'redemptions'])
            ->first();

        if (!$voucher) {
            return response()->json(['message' => 'Voucher not found'], 404);
        }

        // Auto-expire
        if ($voucher->expiry_date && now()->toDateString() > $voucher->expiry_date
            && in_array($voucher->status, ['active', 'partially_used', 'inactive'])) {
            $voucher->status = 'expired';
            $voucher->save();
        }

        return response()->json($voucher);
    }

    public function redeem(Request $request)
    {
        $data = $request->validate([
            'voucher_code'       => 'required|exists:vouchers,voucher_code',
            'amount'             => 'required|numeric|min:0.01',
            'debtor_trans_no'    => 'nullable|integer',
            'debtor_trans_type'  => 'nullable|integer',
        ]);

        $voucher = Voucher::where('voucher_code', $data['voucher_code'])->first();

        if (!in_array($voucher->status, ['active', 'partially_used'])) {
            return response()->json(['message' => 'This voucher is not active'], 422);
        }
        if ($voucher->expiry_date && now()->toDateString() > $voucher->expiry_date) {
            $voucher->status = 'expired'; $voucher->save();
            return response()->json(['message' => 'This voucher has expired'], 422);
        }
        if ($voucher->balance < $data['amount']) {
            return response()->json(['message' => 'Insufficient voucher balance. Available: ' . $voucher->balance], 422);
        }

        try {
            return DB::transaction(function () use ($voucher, $data) {
                $voucher->balance -= $data['amount'];
                if ($voucher->balance <= 0.001) {
                    $voucher->status = 'fully_used';
                    $voucher->balance = 0;
                } else {
                    $voucher->status = 'partially_used';
                }
                $voucher->save();

                $journalTransNo = $this->postRedemptionJournal($voucher, $data);

                $redemption = VoucherRedemption::create([
                    'voucher_id'        => $voucher->id,
                    'debtor_trans_no'   => $data['debtor_trans_no'] ?? null,
                    'debtor_trans_type' => $data['debtor_trans_type'] ?? null,
                    'amount_used'       => $data['amount'],
                    'payment_trans_no'  => $journalTransNo,
                    'redeemed_at'       => now()->toDateString(),
                    'cashier'           => Auth::user()?->name ?? 'Admin',
                ]);

                return response()->json(['voucher' => $voucher, 'redemption' => $redemption], 201);
            });
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to post redemption: ' . $e->getMessage()], 500);
        }
    }

    private function postRedemptionJournal(Voucher $voucher, array $data): ?int
    {
        $hasAccounts = DB::table('chart_master')
            ->whereIn('account_code', [self::VOUCHERS_PAYABLE_ACCOUNT, self::SALES_ACCOUNT])
            ->count() === 2;
        if (!$hasAccounts) return null;

        $result = $this->bankingService->postJournal([
            'tran_date' => now()->toDateString(),
            'reference' => 'Voucher redemption ' . $data['voucher_code'],
            'memo'      => "Voucher {$data['voucher_code']} redeemed for " . number_format((float) $data['amount'], 2),
            'lines'     => [
                ['account_code' => self::VOUCHERS_PAYABLE_ACCOUNT, 'debit' => $data['amount'], 'credit' => 0, 'memo' => 'Voucher redeemed'],
                ['account_code' => self::SALES_ACCOUNT, 'debit' => 0, 'credit' => $data['amount'], 'memo' => 'Voucher redeemed'],
            ],
        ]);

        return (int) ($result['trans_no'] ?? 0) ?: null;
    }

    private function defaultSalesTypeId(): int
    {
        return (int) (DB::table('sales_types')->where('typeName', 'Retail')->value('id')
            ?? DB::table('sales_types')->where('status', 'active')->orderBy('id')->value('id') ?? 1);
    }

    private function defaultShipViaId(): ?int
    {
        return DB::table('shipping_companies')->orderBy('shipper_id')->value('shipper_id');
    }

    private function defaultStockLocation(): ?string
    {
        return DB::table('inventory_locations')->orderBy('loc_code')->value('loc_code');
    }
}
