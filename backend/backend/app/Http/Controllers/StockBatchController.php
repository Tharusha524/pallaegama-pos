<?php

namespace App\Http\Controllers;

use App\Services\Inventory\StockBatchService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Stock batches (one per delivery, each with its own cost, selling price and MRP).
 * Changing a batch's selling price / MRP / status never touches accounting —
 * inventory value and COGS keep using the weighted average cost.
 */
class StockBatchController extends Controller
{
    public function __construct(private StockBatchService $batches)
    {
    }

    /** Batches of one product (optionally one location), newest first. */
    public function index(Request $request)
    {
        $data = $request->validate([
            'stock_id' => 'required|string|max:50',
            'loc_code' => 'nullable|string|max:20',
            'include_finished' => 'nullable|boolean',
        ]);
        $stockId = trim($data['stock_id']);

        $locs = DB::table('loc_stock')->where('stock_id', $stockId)
            ->when(! empty($data['loc_code']), fn ($q) => $q->where('loc_code', $data['loc_code']))
            ->pluck('loc_code');
        DB::transaction(function () use ($stockId, $locs) {
            foreach ($locs as $loc) {
                $this->batches->syncToLocStock($stockId, (string) $loc);
            }
        });

        $rows = DB::table('stock_batches')
            ->where('stock_id', $stockId)
            ->when(! empty($data['loc_code']), fn ($q) => $q->where('loc_code', strtoupper($data['loc_code'])))
            ->when(empty($data['include_finished']), fn ($q) => $q->where('status', '!=', 'finished'))
            ->orderByDesc('id')
            ->get();

        return response()->json($rows);
    }

    /** POS: sellable price groups for a product at a location. */
    public function sellable(Request $request)
    {
        $data = $request->validate([
            'stock_id' => 'required|string|max:50',
            'loc_code' => 'nullable|string|max:20',
        ]);

        return response()->json($this->batches->sellableGroups($data['stock_id'], $data['loc_code'] ?? null));
    }

    /** POS preload: { stock_id: qty } stock waiting for a price — not sellable yet. */
    public function pending(Request $request)
    {
        $data = $request->validate(['loc_code' => 'nullable|string|max:20']);

        return response()->json((object) $this->batches->pendingQtyByProduct($data['loc_code'] ?? null));
    }

    /** POS preload: { stock_id: [price groups] } for products with 2+ prices at a location. */
    public function multiPrice(Request $request)
    {
        $data = $request->validate(['loc_code' => 'nullable|string|max:20']);

        return response()->json((object) $this->batches->multiPriceProducts($data['loc_code'] ?? null));
    }

    /**
     * Report: batches with stock (one row each), plus a check that every
     * product's batches add up to its stock quantity (should always be empty).
     */
    public function report(Request $request)
    {
        $data = $request->validate([
            'loc_code' => 'nullable|string|max:20',
            'search' => 'nullable|string|max:100',
            'only_multi' => 'nullable|boolean',
        ]);
        $loc = ! empty($data['loc_code']) ? strtoupper($data['loc_code']) : null;
        $search = trim((string) ($data['search'] ?? ''));

        $rows = DB::table('stock_batches as b')
            ->join('stock_master as sm', 'sm.stock_id', '=', 'b.stock_id')
            ->where('b.qty_remaining', '!=', 0)
            ->when($loc !== null, fn ($q) => $q->where('b.loc_code', $loc))
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->where('b.stock_id', 'like', "%{$search}%")->orWhere('sm.description', 'like', "%{$search}%")))
            ->when(! empty($data['only_multi']), fn ($q) => $q->whereIn('b.stock_id', array_keys($this->batches->multiPriceProducts($loc))))
            ->orderBy('sm.description')->orderBy('b.loc_code')->orderBy('b.id')
            ->limit(5000)
            ->get(['b.id', 'b.stock_id', 'sm.description', 'b.loc_code', 'b.source_type', 'b.source_no', 'b.purchase_cost',
                'b.selling_price', 'b.mrp', 'b.qty_received', 'b.qty_remaining', 'b.status', 'b.received_date']);

        return response()->json(['rows' => $rows, 'mismatches' => $this->mismatches($loc)]);
    }

    /** Re-align every product whose batches do not add up to its stock quantity. */
    public function fixMismatches(Request $request)
    {
        $loc = $request->filled('loc_code') ? strtoupper((string) $request->input('loc_code')) : null;
        $fixed = 0;
        foreach ($this->mismatches($loc) as $m) {
            DB::transaction(fn () => $this->batches->syncToLocStock($m->stock_id, $m->loc_code));
            $fixed++;
        }

        return response()->json(['fixed' => $fixed]);
    }

    private function mismatches(?string $loc)
    {
        $sums = DB::table('stock_batches')
            ->selectRaw('stock_id, loc_code, SUM(qty_remaining) as batch_qty')
            ->groupBy('stock_id', 'loc_code');

        return DB::table('loc_stock as ls')
            ->joinSub($sums, 's', fn ($j) => $j->on('s.stock_id', '=', 'ls.stock_id')->on('s.loc_code', '=', 'ls.loc_code'))
            ->leftJoin('stock_master as sm', 'sm.stock_id', '=', 'ls.stock_id')
            ->when($loc !== null, fn ($q) => $q->where('ls.loc_code', $loc))
            ->whereRaw('ABS(ls.quantity - s.batch_qty) > 0.0001')
            ->get(['ls.stock_id', 'sm.description', 'ls.loc_code', 'ls.quantity', 's.batch_qty']);
    }

    /** Edit a batch's selling price / MRP, or hide it from the POS (inactive). */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'selling_price' => 'nullable|numeric|min:0',
            'mrp' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,inactive',
        ]);
        $batch = DB::table('stock_batches')->where('id', $id)->first();
        if (! $batch) {
            return response()->json(['message' => 'Batch not found'], 404);
        }

        $update = ['updated_at' => now()];
        if (array_key_exists('selling_price', $data) && $data['selling_price'] !== null) {
            $update['selling_price'] = round((float) $data['selling_price'], 4);
        }
        if (array_key_exists('mrp', $data)) {
            $update['mrp'] = $data['mrp'] === null ? null : round((float) $data['mrp'], 4);
        }
        $price = (float) ($update['selling_price'] ?? $batch->selling_price);
        $hasStock = (float) $batch->qty_remaining > 0;
        if (! empty($data['status'])) {
            // "active" on an empty batch stays finished; without a price it waits as pending.
            $update['status'] = $data['status'] === 'inactive'
                ? 'inactive'
                : (! $hasStock ? 'finished' : ($price > 0 ? 'active' : 'pending'));
        } elseif ($batch->status === 'pending' && $price > 0) {
            // A new-cost delivery just got its price: the till can sell it now.
            $update['status'] = $hasStock ? 'active' : 'finished';
        }
        DB::table('stock_batches')->where('id', $id)->update($update);
        if (array_key_exists('selling_price', $update) || array_key_exists('mrp', $update)) {
            $this->batches->batchPriced($id);
        }

        return response()->json(DB::table('stock_batches')->where('id', $id)->first());
    }
}
