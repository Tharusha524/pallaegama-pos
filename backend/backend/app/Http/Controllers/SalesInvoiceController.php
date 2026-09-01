<?php

namespace App\Http\Controllers;

use App\Http\Requests\PostDirectSalesInvoiceRequest;
use App\Http\Requests\PostSalesInvoiceFromDeliveryRequest;
use App\Models\DebtorsMaster;
use App\Services\Sales\SalesInvoiceService;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;

class SalesInvoiceController extends Controller
{
    public function __construct(private SalesInvoiceService $invoiceService) {}

    public function invoiceFromDelivery(PostSalesInvoiceFromDeliveryRequest $request): JsonResponse
    {
        try {
            $result = $this->invoiceService->invoiceFromDelivery($request->validated());
            $this->afterInvoicePosted($result);

            return response()->json($result, 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to process sales invoice.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function directInvoice(PostDirectSalesInvoiceRequest $request): JsonResponse
    {
        try {
            $result = $this->invoiceService->directInvoice($request->validated());
            $this->afterInvoicePosted($result);

            return response()->json($result, 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to process direct invoice.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function directInvoiceFromTemplate(int $orderNo): JsonResponse
    {
        try {
            $result = $this->invoiceService->directInvoiceFromTemplate($orderNo, request()->all());

            return response()->json($result, 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to process template invoice.', 'error' => $e->getMessage()], 500);
        }
    }

    public function prepaidFinalInvoice(int $orderNo): JsonResponse
    {
        try {
            $result = $this->invoiceService->prepaidFinalInvoice($orderNo, request()->all());

            return response()->json($result, 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to process prepaid final invoice.', 'error' => $e->getMessage()], 500);
        }
    }

    public function void(int $transNo): JsonResponse
    {
        try {
            $result = $this->invoiceService->void($transNo, request()->input('memo'));

            return response()->json($result);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to void sales invoice.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(int $transNo): JsonResponse
    {
        try {
            return response()->json($this->invoiceService->updatePosted($transNo, request()->all()));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to update sales invoice.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Post-invoice hooks: loyalty points earning + last_purchase_date update.
     * Deliberately best-effort and isolated from the invoice's own DB transaction —
     * a loyalty hiccup must never fail or roll back an already-posted invoice.
     */
    private function afterInvoicePosted(array $result): void
    {
        try {
            $debtorTrans = $result['debtor_trans'] ?? null;
            if (!$debtorTrans || empty($debtorTrans['debtor_no'])) {
                return;
            }

            $debtorNo = (int) $debtorTrans['debtor_no'];
            $amount = (float) ($debtorTrans['ov_amount'] ?? 0);
            $transNo = $result['trans_no'] ?? null;
            $transType = $result['trans_type'] ?? null;

            LoyaltyPointsController::earnPoints($debtorNo, $amount, $transNo, $transType);

            DebtorsMaster::where('debtor_no', $debtorNo)->update(['last_purchase_date' => now()->toDateString()]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
