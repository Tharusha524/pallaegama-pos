<?php

namespace App\Http\Controllers;

use App\Http\Requests\PostCustomerPaymentRequest;
use App\Models\LoyaltyCard;
use App\Services\Sales\SalesPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class SalesPaymentController extends Controller
{
    public function __construct(private SalesPaymentService $payments) {}

    public function store(PostCustomerPaymentRequest $request): JsonResponse
    {
        try {
            $result = $this->payments->create($request->validated());
            $this->pointsForPaidInvoices($request->validated());

            return response()->json($result, 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to process payment.', 'error' => $e->getMessage()], 500);
        }
    }

    public function void(int $transNo): JsonResponse
    {
        try {
            return response()->json($this->payments->void($transNo, request()->input('memo')));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function update(int $transNo): JsonResponse
    {
        try {
            return response()->json($this->payments->updatePosted($transNo, request()->all()));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to update payment.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Loyalty points for a credit bill are earned when it is paid: for each
     * invoice this payment is allocated to, award points on the paid part.
     * Capped at the bill's full points, so a bill that already earned its
     * points at sale time (older invoices) never earns twice.
     */
    private function pointsForPaidInvoices(array $payload): void
    {
        try {
            $debtorNo = (int) ($payload['debtor_no'] ?? 0);
            $card = LoyaltyCard::with('tier')->where('debtor_no', $debtorNo)->where('status', 'active')->first();
            $rate = (float) ($card->tier->points_earn_rate ?? 0);
            if (! $card || $rate <= 0) {
                return;
            }

            foreach ($payload['allocations'] ?? [] as $line) {
                $amt = (float) ($line['amt'] ?? 0);
                if ((int) ($line['trans_type_to'] ?? 0) !== 10 || $amt <= 0.001) {
                    continue;
                }
                $transNo = (int) $line['trans_no_to'];
                $inv = DB::table('debtor_trans')->where('trans_type', 10)->where('trans_no', $transNo)->first();
                if (! $inv) {
                    continue;
                }
                $billTotal = (float) $inv->ov_amount + (float) $inv->ov_gst + (float) $inv->ov_freight + (float) $inv->ov_freight_tax + (float) $inv->ov_discount;
                if ($billTotal <= 0.001) {
                    continue;
                }
                $fullPoints = round((float) $inv->ov_amount * $rate, 2);
                $already = (float) DB::table('loyalty_points_transactions')
                    ->where('debtor_trans_type', 10)->where('debtor_trans_no', $transNo)
                    ->sum('points_earned');
                $pointsLeft = $fullPoints - $already;
                if ($pointsLeft <= 0.001) {
                    continue;
                }
                $amount = min($amt * (float) $inv->ov_amount / $billTotal, $pointsLeft / $rate);
                LoyaltyPointsController::earnPoints($debtorNo, round($amount, 2), $transNo, 10);
            }
            LoyaltyPointsController::upgradeTier($debtorNo);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
