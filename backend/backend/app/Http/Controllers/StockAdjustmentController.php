<?php

namespace App\Http\Controllers;

use App\Models\StockAdjustment;
use App\Services\Inventory\StockBatchService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockAdjustmentController extends Controller
{
    public function index(Request $request)
    {
        $query = StockAdjustment::with([
            'stock:stock_id,description',
            'recordedByUser:id,first_name,last_name',
        ])->orderByDesc('id');
        if ($request->filled('stock_id')) {
            $query->where('stock_id', $request->query('stock_id'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'stock_id' => 'required|exists:stock_master,stock_id',
            'loc_code' => 'required|exists:inventory_locations,loc_code',
            'movement_type' => 'required|in:add,reduce,override',
            'quantity' => 'required|numeric|min:0',
            'reason' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'batch_id' => 'nullable|integer',
        ]);

        return DB::transaction(function () use ($data, $request) {
            // Use query builder (not Eloquent ->save()) — loc_stock has a
            // composite primary key that Eloquent's save() cannot handle.
            $row = DB::table('loc_stock')
                ->where('stock_id', $data['stock_id'])
                ->where('loc_code', $data['loc_code'])
                ->lockForUpdate()
                ->first();

            $before = (float) ($row->quantity ?? 0);

            $after = match ($data['movement_type']) {
                'add' => $before + $data['quantity'],
                'reduce' => max(0, $before - $data['quantity']),
                'override' => $data['quantity'],
            };

            $moved = $after - $before;

            if ($row) {
                DB::table('loc_stock')
                    ->where('stock_id', $data['stock_id'])
                    ->where('loc_code', $data['loc_code'])
                    ->update(['quantity' => $after, 'updated_at' => now()]);
            } else {
                DB::table('loc_stock')->insert([
                    'stock_id' => $data['stock_id'],
                    'loc_code' => $data['loc_code'],
                    'quantity' => $after,
                    'reorder_level' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Keep the product's stock batches in step (chosen batch, else FIFO / newest).
            app(StockBatchService::class)->applyDelta($data['stock_id'], $data['loc_code'], $moved, $before, [
                'batch_id' => $data['batch_id'] ?? null,
                'source_type' => 'adjustment',
                'note' => 'Stock adjustment ('.$data['movement_type'].')',
            ]);

            $adjustment = StockAdjustment::create([
                'stock_id' => $data['stock_id'],
                'loc_code' => $data['loc_code'],
                'movement_type' => $data['movement_type'],
                'quantity_before' => $before,
                'quantity_moved' => $moved,
                'quantity_after' => $after,
                'reason' => $data['reason'] ?? null,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $request->user()->id ?? null,
            ]);

            return response()->json($adjustment, 201);
        });
    }
}
