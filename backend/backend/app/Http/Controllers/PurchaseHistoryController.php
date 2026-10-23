<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Purchase History (read-only): every goods receipt (GRN) already posted —
 * from Purchase and from Direct Supplier Invoice — with its items, cost and
 * the selling price / MRP its stock batch got. Nothing is written here.
 */
class PurchaseHistoryController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'supplier_id' => 'nullable|integer',
            'search' => 'nullable|string|max:100',
        ]);
        $search = trim((string) ($data['search'] ?? ''));

        $totals = DB::table('grn_items as gi')
            ->leftJoin('purch_order_details as pod', 'pod.po_detail_item', '=', 'gi.po_detail_item')
            ->selectRaw('gi.grn_batch_id, COUNT(*) as item_count, SUM(gi.qty_recd) as total_qty,
                SUM(gi.qty_recd * COALESCE(pod.unit_price, 0) * (1 - COALESCE(pod.discount_percent, 0) / 100)) as total')
            ->groupBy('gi.grn_batch_id');

        $rows = DB::table('grn_batch as g')
            ->joinSub($totals, 't', 't.grn_batch_id', '=', 'g.id')
            ->leftJoin('suppliers as s', 's.supplier_id', '=', 'g.supplier_id')
            ->leftJoin('inventory_locations as l', 'l.loc_code', '=', 'g.loc_code')
            ->when(! empty($data['from_date']), fn ($q) => $q->whereDate('g.delivery_date', '>=', $data['from_date']))
            ->when(! empty($data['to_date']), fn ($q) => $q->whereDate('g.delivery_date', '<=', $data['to_date']))
            ->when(! empty($data['supplier_id']), fn ($q) => $q->where('g.supplier_id', (int) $data['supplier_id']))
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('g.reference', 'like', "%{$search}%")
                ->orWhereExists(fn ($e) => $e->from('grn_items as gi2')
                    ->leftJoin('stock_master as sm', 'sm.stock_id', '=', 'gi2.item_code')
                    ->whereColumn('gi2.grn_batch_id', 'g.id')
                    ->where(fn ($p) => $p->where('gi2.item_code', 'like', "%{$search}%")
                        ->orWhere('gi2.description', 'like', "%{$search}%")
                        ->orWhere('sm.description', 'like', "%{$search}%")))))
            ->orderByDesc('g.delivery_date')->orderByDesc('g.id')
            ->limit(1000)
            ->get([
                'g.id', 'g.reference', 'g.delivery_date', 'g.loc_code', 'g.purch_order_no',
                's.supplier_id', 's.supp_name', 'l.location_name',
                't.item_count', 't.total_qty', 't.total',
            ]);

        return response()->json($rows);
    }

    public function show(int $id)
    {
        $grn = DB::table('grn_batch as g')
            ->leftJoin('suppliers as s', 's.supplier_id', '=', 'g.supplier_id')
            ->leftJoin('inventory_locations as l', 'l.loc_code', '=', 'g.loc_code')
            ->where('g.id', $id)
            ->first(['g.id', 'g.reference', 'g.delivery_date', 'g.loc_code', 'g.purch_order_no', 's.supp_name', 'l.location_name']);
        if (! $grn) {
            return response()->json(['message' => 'Purchase not found'], 404);
        }

        $items = DB::table('grn_items as gi')
            ->leftJoin('purch_order_details as pod', 'pod.po_detail_item', '=', 'gi.po_detail_item')
            ->leftJoin('stock_master as sm', 'sm.stock_id', '=', 'gi.item_code')
            ->where('gi.grn_batch_id', $id)
            ->orderBy('gi.id')
            ->get([
                'gi.item_code', DB::raw('COALESCE(sm.description, gi.description) as description'),
                'gi.qty_recd', 'pod.unit_price', 'pod.discount_percent',
            ]);

        // The stock batch each line went into (this GRN's own batch, or the
        // same-price batch it was added to) — for its selling price / MRP.
        $hasBatches = Schema::hasTable('stock_batch_movements');
        foreach ($items as $it) {
            $it->line_total = round((float) $it->qty_recd * (float) $it->unit_price * (1 - (float) $it->discount_percent / 100), 2);
            $it->selling_price = null;
            $it->mrp = null;
            if ($hasBatches) {
                $batch = DB::table('stock_batch_movements as m')
                    ->join('stock_batches as b', 'b.id', '=', 'm.batch_id')
                    ->where('m.trans_type', 25)->where('m.trans_no', $id)->where('m.stock_id', $it->item_code)->where('m.qty', '>', 0)
                    ->orderByDesc('m.id')
                    ->first(['b.selling_price', 'b.mrp', 'b.status']);
                $it->price_pending = $batch && $batch->status === 'pending';
                if ($batch && $batch->status !== 'pending') {
                    $it->selling_price = (float) $batch->selling_price;
                    $it->mrp = $batch->mrp === null ? null : (float) $batch->mrp;
                }
            }
        }

        return response()->json(['grn' => $grn, 'items' => $items]);
    }
}
