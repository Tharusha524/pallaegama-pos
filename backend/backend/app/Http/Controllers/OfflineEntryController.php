<?php

namespace App\Http\Controllers;

use App\Models\OfflineEntry;
use Illuminate\Http\Request;

class OfflineEntryController extends Controller
{
    public function index(Request $request)
    {
        $query = OfflineEntry::with(['debtor:debtor_no,name', 'supplier:supplier_id,supp_name'])->orderByDesc('entry_date');
        if ($request->filled('entry_type')) {
            $query->where('entry_type', $request->query('entry_type'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'entry_type' => 'required|in:sale,purchase',
            'entry_date' => 'required|date',
            'debtor_no' => 'nullable|exists:debtors_master,debtor_no',
            'supplier_id' => 'nullable|exists:suppliers,supplier_id',
            'total_amount' => 'required|numeric|min:0',
            'payment_breakdown' => 'required|array|min:1',
            'payment_breakdown.*.method' => 'required|string',
            'payment_breakdown.*.amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $data['recorded_by'] = $request->user()->id ?? null;

        return response()->json(OfflineEntry::create($data), 201);
    }

    public function update(Request $request, string $id)
    {
        $entry = OfflineEntry::find($id);
        if (!$entry) {
            return response()->json(['message' => 'Entry not found'], 404);
        }

        $data = $request->validate([
            'entry_date' => 'sometimes|required|date',
            'debtor_no' => 'nullable|exists:debtors_master,debtor_no',
            'supplier_id' => 'nullable|exists:suppliers,supplier_id',
            'total_amount' => 'sometimes|required|numeric|min:0',
            'payment_breakdown' => 'sometimes|required|array|min:1',
            'notes' => 'nullable|string',
        ]);

        $entry->update($data);
        return response()->json($entry);
    }

    public function destroy(string $id)
    {
        $entry = OfflineEntry::find($id);
        if (!$entry) {
            return response()->json(['message' => 'Entry not found'], 404);
        }
        $entry->delete();
        return response()->json(['message' => 'Entry removed']);
    }
}
