<?php

namespace App\Http\Controllers;

use App\Models\Warranty;
use App\Models\WarrantyPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WarrantyController extends Controller
{
    public function index(Request $request)
    {
        $query = Warranty::with(['stock:stock_id,description', 'policy'])->orderByDesc('id');
        if ($request->filled('stock_id')) {
            $query->where('stock_id', $request->query('stock_id'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'stock_id' => 'required|exists:stock_master,stock_id',
            'debtor_trans_no' => 'nullable|integer',
            'debtor_trans_type' => 'nullable|integer',
            'warranty_policy_id' => 'required|exists:warranty_policies,id',
            'serial_no' => 'nullable|string',
            'warranty_start' => 'required|date',
        ]);

        $policy = WarrantyPolicy::findOrFail($data['warranty_policy_id']);
        $start = \Carbon\Carbon::parse($data['warranty_start']);
        $end = match ($policy->period_unit) {
            'days' => $start->copy()->addDays($policy->period_value),
            'years' => $start->copy()->addYears($policy->period_value),
            default => $start->copy()->addMonths($policy->period_value),
        };

        $data['warranty_end'] = $end->toDateString();
        $data['status'] = 'active';

        return response()->json(Warranty::create($data)->load(['stock:stock_id,description', 'policy']), 201);
    }

    /**
     * Check warranty by invoice number, serial number, or customer phone.
     */
    public function check(Request $request)
    {
        $query = $request->query('query', '');
        if ($query === '') {
            return response()->json(['message' => 'Provide an invoice number, serial number, or phone to search'], 422);
        }

        $warranties = Warranty::with(['stock:stock_id,description', 'policy'])
            ->where('serial_no', $query)
            ->orWhereIn('debtor_trans_no', function ($q) use ($query) {
                $q->select('trans_no')->from('debtor_trans')->where('reference', $query);
            })
            ->orWhereIn('debtor_trans_no', function ($q) use ($query) {
                $q->select('dt.trans_no')
                    ->from('debtor_trans as dt')
                    ->join('debtors_master as dm', 'dm.debtor_no', '=', 'dt.debtor_no')
                    ->where('dm.mobile', $query);
            })
            ->get();

        return response()->json($warranties);
    }

    public function destroy(string $id)
    {
        $warranty = Warranty::find($id);
        if (!$warranty) {
            return response()->json(['message' => 'Warranty not found'], 404);
        }
        $warranty->update(['status' => 'voided']);
        return response()->json(['message' => 'Warranty voided']);
    }
}
