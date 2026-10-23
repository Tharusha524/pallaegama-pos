<?php

namespace App\Http\Controllers;

use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Services\Inventory\StockBatchService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StockTransferController extends Controller
{
    public function index()
    {
        return response()->json(StockTransfer::with('items.stock:stock_id,description')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'from_loc_code' => 'required|exists:inventory_locations,loc_code|different:to_loc_code',
            'to_loc_code' => 'required|exists:inventory_locations,loc_code',
            'items' => 'required|array|min:1',
            'items.*.stock_id' => 'required|exists:stock_master,stock_id',
            'items.*.quantity' => 'required|numeric|min:0.01',
        ]);

        $transfer = DB::transaction(function () use ($data, $request) {
            $transfer = StockTransfer::create([
                'transfer_ref' => 'ST-' . strtoupper(Str::random(8)),
                'from_loc_code' => $data['from_loc_code'],
                'to_loc_code' => $data['to_loc_code'],
                'status' => 'pending',
                'created_by' => $request->user()->id ?? null,
            ]);

            foreach ($data['items'] as $item) {
                StockTransferItem::create([
                    'stock_transfer_id' => $transfer->id,
                    'stock_id' => $item['stock_id'],
                    'quantity' => $item['quantity'],
                ]);
            }

            return $transfer->load('items.stock:stock_id,description');
        });

        return response()->json($transfer, 201);
    }

    /**
     * Dispatch: deduct stock from the source location.
     */
    public function dispatch(string $id)
    {
        $transfer = StockTransfer::with('items')->find($id);
        if (!$transfer) {
            return response()->json(['message' => 'Transfer not found'], 404);
        }
        if ($transfer->status !== 'pending') {
            return response()->json(['message' => 'Only a pending transfer can be dispatched'], 422);
        }

        DB::transaction(function () use ($transfer) {
            $batches = app(StockBatchService::class);
            foreach ($transfer->items as $item) {
                $before = DB::table('loc_stock')->where('stock_id', $item->stock_id)
                    ->where('loc_code', $transfer->from_loc_code)->lockForUpdate()->value('quantity');
                DB::table('loc_stock')
                    ->where('stock_id', $item->stock_id)
                    ->where('loc_code', $transfer->from_loc_code)
                    ->decrement('quantity', $item->quantity);
                if ($before !== null) {
                    $batches->applyDelta($item->stock_id, $transfer->from_loc_code, -(float) $item->quantity, (float) $before, [
                        'trans_type' => StockBatchService::TRANS_TRANSFER,
                        'trans_no' => $transfer->id,
                        'note' => 'Transfer out '.$transfer->transfer_ref,
                    ]);
                }
            }
            $transfer->update(['status' => 'dispatched', 'dispatched_at' => now()]);
        });

        return response()->json($transfer->fresh(['items.stock:stock_id,description']));
    }

    /**
     * Receive: add stock to the destination location.
     */
    public function receive(string $id)
    {
        $transfer = StockTransfer::with('items')->find($id);
        if (!$transfer) {
            return response()->json(['message' => 'Transfer not found'], 404);
        }
        if ($transfer->status !== 'dispatched') {
            return response()->json(['message' => 'Only a dispatched transfer can be received'], 422);
        }

        DB::transaction(function () use ($transfer) {
            $batches = app(StockBatchService::class);
            foreach ($transfer->items as $item) {
                $before = DB::table('loc_stock')->where('stock_id', $item->stock_id)
                    ->where('loc_code', $transfer->to_loc_code)->lockForUpdate()->value('quantity');
                $exists = $before !== null;

                if ($exists) {
                    DB::table('loc_stock')
                        ->where('stock_id', $item->stock_id)
                        ->where('loc_code', $transfer->to_loc_code)
                        ->increment('quantity', $item->quantity);
                } else {
                    DB::table('loc_stock')->insert([
                        'stock_id' => $item->stock_id,
                        'loc_code' => $transfer->to_loc_code,
                        'quantity' => $item->quantity,
                        'reorder_level' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                // Arrives as batches with the same prices / MRP it left with.
                $batches->applyDelta($item->stock_id, $transfer->to_loc_code, (float) $item->quantity, (float) ($before ?? 0), [
                    'clone_from' => ['type' => StockBatchService::TRANS_TRANSFER, 'no' => $transfer->id, 'loc_code' => $transfer->from_loc_code],
                    'source_type' => 'transfer',
                    'source_no' => $transfer->id,
                    'trans_type' => StockBatchService::TRANS_TRANSFER,
                    'trans_no' => $transfer->id,
                    'note' => 'Transfer in '.$transfer->transfer_ref,
                ]);
            }
            $transfer->update(['status' => 'received', 'received_at' => now()]);
        });

        return response()->json($transfer->fresh(['items.stock:stock_id,description']));
    }

    public function cancel(string $id)
    {
        $transfer = StockTransfer::find($id);
        if (!$transfer) {
            return response()->json(['message' => 'Transfer not found'], 404);
        }
        if ($transfer->status !== 'pending') {
            return response()->json(['message' => 'Only a pending transfer can be cancelled'], 422);
        }
        $transfer->update(['status' => 'cancelled']);
        return response()->json($transfer);
    }
}
