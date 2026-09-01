<?php

namespace App\Http\Controllers;

use App\Models\Voucher;
use App\Models\VoucherRedemption;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VoucherController extends Controller
{
    public function index()
    {
        return response()->json(Voucher::with('debtor:debtor_no,name')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'debtor_no' => 'nullable|exists:debtors_master,debtor_no',
            'face_value' => 'required|numeric|min:1',
            'expiry_date' => 'nullable|date',
            'note' => 'nullable|string',
        ]);

        $data['voucher_code'] = 'GV-' . strtoupper(Str::random(10));
        $data['balance'] = $data['face_value'];
        $data['issue_date'] = now()->toDateString();
        $data['status'] = 'active';

        return response()->json(Voucher::create($data)->load('debtor:debtor_no,name'), 201);
    }

    public function show(string $code)
    {
        $voucher = Voucher::where('voucher_code', $code)->first();
        if (!$voucher) {
            return response()->json(['message' => 'Voucher not found'], 404);
        }
        return response()->json($voucher);
    }

    /**
     * Redeem part or all of a voucher's balance toward a sale.
     */
    public function redeem(Request $request)
    {
        $data = $request->validate([
            'voucher_code' => 'required|exists:vouchers,voucher_code',
            'amount' => 'required|numeric|min:0.01',
            'debtor_trans_no' => 'nullable|integer',
            'debtor_trans_type' => 'nullable|integer',
        ]);

        $voucher = Voucher::where('voucher_code', $data['voucher_code'])->first();

        if ($voucher->status !== 'active') {
            return response()->json(['message' => 'This voucher is not active'], 422);
        }
        if ($voucher->expiry_date && now()->toDateString() > $voucher->expiry_date) {
            return response()->json(['message' => 'This voucher has expired'], 422);
        }
        if ($voucher->balance < $data['amount']) {
            return response()->json(['message' => 'Insufficient voucher balance'], 422);
        }

        return DB::transaction(function () use ($voucher, $data) {
            $voucher->balance -= $data['amount'];
            if ($voucher->balance <= 0.001) {
                $voucher->status = 'redeemed';
            }
            $voucher->save();

            $redemption = VoucherRedemption::create([
                'voucher_id' => $voucher->id,
                'debtor_trans_no' => $data['debtor_trans_no'] ?? null,
                'debtor_trans_type' => $data['debtor_trans_type'] ?? null,
                'amount_used' => $data['amount'],
                'redeemed_at' => now()->toDateString(),
            ]);

            return response()->json(['voucher' => $voucher, 'redemption' => $redemption], 201);
        });
    }
}
