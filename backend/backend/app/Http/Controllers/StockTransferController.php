<?php

namespace App\Http\Controllers;

use App\Models\StockTransfer;
use App\Models\StockTransferItem;
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
            foreach ($transfer->items as $item) {
                DB::table('loc_stock')
                    ->where('stock_id', $item->stock_id)
                    ->where('loc_code', $transfer->from_loc_code)
                    ->decrement('quantity', $item->quantity);
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
            foreach ($transfer->items as $item) {
                $exists = DB::table('loc_stock')
                    ->where('stock_id', $item->stock_id)
                    ->where('loc_code', $transfer->to_loc_code)
                    ->exists();

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
