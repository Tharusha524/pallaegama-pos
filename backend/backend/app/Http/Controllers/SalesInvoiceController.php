<?php

namespace App\Http\Controllers;

use App\Http\Requests\PostDirectSalesInvoiceRequest;
use App\Http\Requests\PostSalesInvoiceFromDeliveryRequest;
use App\Models\DebtorsMaster;
use App\Services\Sales\SalesInvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
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
            $this->linkPosShift($request->validated(), $result);
            $this->logPriceOverrides($request->validated(), $result);

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
        // void() deletes the debtor_trans header/details — snapshot what we
        // need for the Void Report BEFORE calling it, since there's nothing
        // left to read afterward.
        $before = DB::table('debtor_trans as dt')
            ->leftJoin('debtors_master as dm', 'dm.debtor_no', '=', 'dt.debtor_no')
            ->where('dt.trans_type', 10)
            ->where('dt.trans_no', $transNo)
            ->select('dt.debtor_no', 'dm.name as customer_name', 'dt.ov_amount')
            ->first();

        try {
            $memo = request()->input('memo');
            $result = $this->invoiceService->void($transNo, $memo);
            $this->logVoidedSale($transNo, $before, $memo);

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

    /**
     * Void Report data only — best-effort, isolated from the void's own DB
     * transaction (which has already committed by the time this runs), so
     * a logging hiccup can never undo or block a void that already happened.
     */
    private function logVoidedSale(int $transNo, $before, ?string $memo): void
    {
        try {
            if (!$before) {
                return;
            }

            DB::table('voided_sales_log')->insert([
                'trans_no' => $transNo,
                'trans_type' => 10,
                'debtor_no' => $before->debtor_no,
                'customer_name' => $before->customer_name,
                'amount' => (float) $before->ov_amount,
                'memo' => $memo,
                'voided_by' => auth()->id(),
                'voided_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
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
            LoyaltyPointsController::upgradeTier($debtorNo);

            DebtorsMaster::where('debtor_no', $debtorNo)->update(['last_purchase_date' => now()->toDateString()]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * Tags the posted sale with the cashier's open shift, for the
     * Sales-by-Cashier/Shift report only. Best-effort and isolated from the
     * invoice's own DB transaction, same as afterInvoicePosted() above —
     * never touches accounting figures and must never fail the sale.
     */
    private function linkPosShift(array $payload, array $result): void
    {
        try {
            $shiftId = (int) ($payload['pos_shift_id'] ?? 0);
            $transNo = (int) ($result['trans_no'] ?? 0);
            if ($shiftId <= 0 || $transNo <= 0) {
                return;
            }

            \Illuminate\Support\Facades\DB::table('pos_sale_shift_links')->insert([
                'debtor_trans_no' => $transNo,
                'debtor_trans_type' => (int) ($result['trans_type'] ?? 10),
                'pos_shift_id' => $shiftId,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * Price-Override Audit data only — the sale already posted at whatever
     * unit_price the cashier ended up with, before this ever runs. Same
     * best-effort, isolated pattern as linkPosShift() above.
     */
    private function logPriceOverrides(array $payload, array $result): void
    {
        try {
            $overrides = $payload['price_overrides'] ?? [];
            $transNo = (int) ($result['trans_no'] ?? 0);
            if (!is_array($overrides) || $overrides === [] || $transNo <= 0) {
                return;
            }

            $rows = array_map(fn ($o) => [
                'debtor_trans_no' => $transNo,
                'debtor_trans_type' => (int) ($result['trans_type'] ?? 10),
                'stock_id' => (string) $o['stock_id'],
                'original_price' => (float) $o['original_price'],
                'new_price' => (float) $o['new_price'],
                'cashier_id' => auth()->id(),
                'created_at' => now(),
            ], $overrides);

            \Illuminate\Support\Facades\DB::table('price_override_log')->insert($rows);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
