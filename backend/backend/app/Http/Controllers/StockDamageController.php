<?php

namespace App\Http\Controllers;

use App\Models\StockDamage;
use App\Services\Inventory\InventoryTransactionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class StockDamageController extends Controller
{
    public function index(Request $request)
    {
        $query = StockDamage::with('stock:stock_id,description')->orderByDesc('damage_date');

        if ($request->filled('stock_id')) {
            $query->where('stock_id', $request->query('stock_id'));
        }
        if ($request->filled('from_date') && $request->filled('to_date')) {
            $query->whereBetween('damage_date', [$request->query('from_date'), $request->query('to_date')]);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'stock_id' => 'required|exists:stock_master,stock_id',
            'loc_code' => 'nullable|string|max:20',
            'quantity' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string|max:255',
            'damage_date' => 'nullable|date',
            'batch_id' => 'nullable|integer',
            // Damaged customer return: take it out of the batch that return just put it in.
            'return_trans_no' => 'nullable|integer|min:1',
        ]);
        $batchId = $data['batch_id'] ?? null;
        $returnTransNo = $data['return_trans_no'] ?? null;
        unset($data['batch_id'], $data['return_trans_no']);

        $data['damage_date'] = $data['damage_date'] ?? now()->toDateString();
        $data['recorded_by'] = $request->user()->id ?? null;

        // No location sent (older screens / offline queue): use the location that
        // holds most of this item's stock.
        if (empty($data['loc_code'])) {
            $data['loc_code'] = DB::table('loc_stock')->where('stock_id', $data['stock_id'])
                ->where('quantity', '>', 0)->orderByDesc('quantity')->value('loc_code');
        }
        if (empty($data['loc_code'])) {
            return response()->json(['message' => 'This item has no stock at any location to mark as damaged.'], 422);
        }
        $data['loc_code'] = strtoupper((string) $data['loc_code']);

        try {
            return DB::transaction(function () use ($data, $batchId, $returnTransNo) {
                $damage = StockDamage::create($data);

                // Same posting as the ERP's Inventory Adjustment: removes the stock
                // (and from the picked batch), and records the loss at average cost —
                // Inventory account down, the item's Adjustment account up.
                $result = app(InventoryTransactionService::class)->adjustment([
                    'loc_code' => $data['loc_code'],
                    'trans_date' => $data['damage_date'],
                    'comments' => trim('Stock damage #'.$damage->id.' '.($data['reason'] ?? '')),
                ], [[
                    'stock_id' => $data['stock_id'],
                    'quantity' => -1 * (float) $data['quantity'],
                    'batch' => [
                        'batch_id' => $batchId,
                        'undo_of' => $returnTransNo ? ['type' => 11, 'no' => (int) $returnTransNo] : null,
                        'note' => 'Damage #'.$damage->id,
                    ],
                ]]);

                $damage->adjustment_trans_no = (int) $result['trans_no'];
                $damage->save();

                $payload = $damage->toArray();
                if (! empty($result['gl_warning'])) {
                    $payload['gl_warning'] = $result['gl_warning'];
                }

                return response()->json($payload, 201);
            });
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function destroy(string $id)
    {
        $damage = StockDamage::find($id);
        if (!$damage) {
            return response()->json(['message' => 'Damage record not found'], 404);
        }

        try {
            DB::transaction(function () use ($damage) {
                // Undo what the damage posted: the stock goes back (into the same
                // batch) and the loss is reversed at the same cost.
                if ($damage->adjustment_trans_no) {
                    $moves = DB::table('stock_moves')->where('type', InventoryTransactionService::TYPE_ADJUSTMENT)
                        ->where('trans_no', $damage->adjustment_trans_no)->get();
                    $lines = [];
                    foreach ($moves as $m) {
                        $lines[] = [
                            'stock_id' => $m->stock_id,
                            'quantity' => -1 * (float) $m->qty,
                            'standard_cost' => (float) $m->standard_cost,
                            'batch' => [
                                'restore_from' => ['type' => InventoryTransactionService::TYPE_ADJUSTMENT, 'no' => (int) $damage->adjustment_trans_no],
                                'note' => 'Damage #'.$damage->id.' deleted',
                            ],
                        ];
                    }
                    if ($lines !== []) {
                        app(InventoryTransactionService::class)->adjustment([
                            'loc_code' => (string) $moves->first()->loc_code,
                            'trans_date' => now()->toDateString(),
                            'comments' => 'Reversal of stock damage #'.$damage->id,
                        ], $lines);
                    }
                }
                $damage->delete();
            });
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Damage record deleted']);
    }

    /**
     * Summary: total damaged quantity per item over a period (proposal's
     * "Quantity Damaged During Last Month" field).
     */
    public function summary(Request $request)
    {
        $query = StockDamage::select('stock_id')
            ->selectRaw('SUM(quantity) as total_damaged')
            ->with('stock:stock_id,description')
            ->groupBy('stock_id');

        if ($request->filled('from_date') && $request->filled('to_date')) {
            $query->whereBetween('damage_date', [$request->query('from_date'), $request->query('to_date')]);
        }

        return response()->json($query->get());
    }
}
