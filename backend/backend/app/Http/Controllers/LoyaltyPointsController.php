<?php

namespace App\Http\Controllers;

use App\Models\LoyaltyCard;
use App\Models\LoyaltyPointsTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoyaltyPointsController extends Controller
{
    /**
     * Manually earn points for a debtor (also called internally from SalesInvoiceController).
     */
    public function earn(Request $request)
    {
        $data = $request->validate([
            'debtor_no' => 'required|exists:debtors_master,debtor_no',
            'amount_spent' => 'required|numeric|min:0',
            'debtor_trans_no' => 'nullable|integer',
            'debtor_trans_type' => 'nullable|integer',
        ]);

        $result = self::earnPoints(
            $data['debtor_no'],
            $data['amount_spent'],
            $data['debtor_trans_no'] ?? null,
            $data['debtor_trans_type'] ?? null
        );

        if (!$result) {
            return response()->json(['message' => 'No active loyalty card for this customer'], 404);
        }

        return response()->json($result, 201);
    }

    public function redeem(Request $request)
    {
        $data = $request->validate([
            'debtor_no' => 'required|exists:debtors_master,debtor_no',
            'points' => 'required|numeric|min:0.01',
            'debtor_trans_no' => 'nullable|integer',
            'debtor_trans_type' => 'nullable|integer',
        ]);

        $card = LoyaltyCard::where('debtor_no', $data['debtor_no'])->where('status', 'active')->first();
        if (!$card) {
            return response()->json(['message' => 'No active loyalty card for this customer'], 404);
        }

        if ($card->points_balance < $data['points']) {
            return response()->json(['message' => 'Insufficient points balance'], 422);
        }

        return DB::transaction(function () use ($card, $data) {
            $card->points_balance -= $data['points'];
            $card->save();

            $txn = LoyaltyPointsTransaction::create([
                'debtor_no' => $data['debtor_no'],
                'debtor_trans_no' => $data['debtor_trans_no'] ?? null,
                'debtor_trans_type' => $data['debtor_trans_type'] ?? null,
                'points_earned' => 0,
                'points_redeemed' => $data['points'],
                'balance_after' => $card->points_balance,
                'transaction_date' => now()->toDateString(),
            ]);

            return response()->json($txn, 201);
        });
    }

    public function history(string $debtorNo)
    {
        $history = LoyaltyPointsTransaction::where('debtor_no', $debtorNo)
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->get();

        return response()->json($history);
    }

    /**
     * Static helper used by SalesInvoiceController to award points at invoice time.
     */
    public static function earnPoints(int $debtorNo, float $amountSpent, ?int $transNo = null, ?int $transType = null): ?LoyaltyPointsTransaction
    {
        $card = LoyaltyCard::with('tier')->where('debtor_no', $debtorNo)->where('status', 'active')->first();
        if (!$card) {
            return null;
        }

        $earnRate = $card->tier->points_earn_rate ?? 0;
        $pointsEarned = round($amountSpent * $earnRate, 2);

        return DB::transaction(function () use ($card, $pointsEarned, $debtorNo, $transNo, $transType) {
            $card->points_balance += $pointsEarned;
            $card->save();

            return LoyaltyPointsTransaction::create([
                'debtor_no' => $debtorNo,
                'debtor_trans_no' => $transNo,
                'debtor_trans_type' => $transType,
                'points_earned' => $pointsEarned,
                'points_redeemed' => 0,
                'balance_after' => $card->points_balance,
                'transaction_date' => now()->toDateString(),
            ]);
        });
    }
}
