<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Read-only data for reprinting an old POS receipt. Nothing here writes to
 * any table — it only reads posted invoices back in the shape the receipt
 * dialog already uses.
 */
class PosReprintController extends Controller
{
    private const TYPE_INVOICE = 10;

    /** Invoices between two dates (default: today), newest first. */
    public function index(Request $request): JsonResponse
    {
        $from = $request->query('from_date', now()->toDateString());
        $to = $request->query('to_date', now()->toDateString());
        $search = trim((string) $request->query('search', ''));

        $rows = DB::table('debtor_trans as dt')
            ->leftJoin('debtors_master as dm', 'dm.debtor_no', '=', 'dt.debtor_no')
            ->where('dt.trans_type', self::TYPE_INVOICE)
            ->whereBetween('dt.tran_date', [$from, $to])
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($w) use ($search) {
                    $w->where('dt.trans_no', $search)
                        ->orWhere('dt.reference', 'like', "%{$search}%")
                        ->orWhere('dm.name', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('dt.trans_no')
            ->limit(500)
            ->get([
                'dt.trans_no',
                'dt.reference',
                'dt.tran_date',
                'dt.created_at',
                'dm.name as customer_name',
                DB::raw('(dt.ov_amount + dt.ov_gst + dt.ov_freight + dt.ov_freight_tax) as total'),
            ]);

        return response()->json($rows);
    }

    /** One invoice with its lines, payments and shift, ready for the receipt. */
    public function show(int $transNo): JsonResponse
    {
        $header = DB::table('debtor_trans')
            ->where('trans_type', self::TYPE_INVOICE)
            ->where('trans_no', $transNo)
            ->first();

        if (! $header) {
            return response()->json(['message' => 'Invoice not found.'], 404);
        }

        $lines = DB::table('debtor_trans_details as d')
            ->leftJoin('stock_master as sm', 'sm.stock_id', '=', 'd.stock_id')
            ->where('d.debtor_trans_type', self::TYPE_INVOICE)
            ->where('d.debtor_trans_no', $transNo)
            ->orderBy('d.id')
            ->get([
                'd.stock_id',
                DB::raw('COALESCE(d.description, sm.description) as description'),
                'd.quantity',
                'd.unit_price',
                'd.discount_percent',
                'sm.mrp_price',
            ]);

        $payments = DB::table('cust_allocations as ca')
            ->leftJoin('bank_trans as bt', function ($join) {
                $join->on('bt.trans_no', '=', 'ca.trans_no_from')
                    ->on('bt.type', '=', 'ca.trans_type_from');
            })
            ->leftJoin('bank_accounts as ba', 'ba.id', '=', 'bt.bank_act')
            ->where('ca.trans_type_to', self::TYPE_INVOICE)
            ->where('ca.trans_no_to', $transNo)
            ->orderBy('ca.id')
            ->get([
                DB::raw("COALESCE(ba.bank_account_name, 'Payment') as method"),
                'ca.amt as amount',
            ]);

        // Exact copy saved when the receipt was first printed (new bills only).
        $copy = null;
        if (Schema::hasTable('pos_receipt_copies')) {
            $raw = DB::table('pos_receipt_copies')->where('trans_no', $transNo)->value('data');
            $copy = $raw ? json_decode($raw, true) : null;
        }

        $customer = DB::table('debtors_master')->where('debtor_no', $header->debtor_no)->first();
        $shiftId = DB::table('pos_sale_shift_links')
            ->where('debtor_trans_type', self::TYPE_INVOICE)
            ->where('debtor_trans_no', $transNo)
            ->value('pos_shift_id');

        return response()->json([
            'trans_no' => $header->trans_no,
            'reference' => $header->reference,
            'tran_date' => $header->tran_date,
            'created_at' => $header->created_at,
            'customer_name' => $customer->name ?? null,
            'total' => (float) $header->ov_amount + (float) $header->ov_gst
                + (float) $header->ov_freight + (float) $header->ov_freight_tax,
            'lines' => $lines,
            'payments' => $payments,
            'shift_id' => $shiftId,
            'copy' => $copy,
        ]);
    }

    /**
     * Save exactly what a receipt showed, right after the sale (called in the
     * background by the POS). Only for invoices that really exist; never
     * touches any accounting table.
     */
    public function storeCopy(Request $request, int $transNo): JsonResponse
    {
        $data = $request->validate(['data' => 'required|array']);

        $exists = DB::table('debtor_trans')
            ->where('trans_type', self::TYPE_INVOICE)
            ->where('trans_no', $transNo)
            ->exists();
        if (! $exists || ! Schema::hasTable('pos_receipt_copies')) {
            return response()->json(['message' => 'Invoice not found.'], 404);
        }

        DB::table('pos_receipt_copies')->updateOrInsert(
            ['trans_no' => $transNo],
            ['data' => json_encode($data['data'], JSON_UNESCAPED_UNICODE), 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['saved' => true]);
    }
}
