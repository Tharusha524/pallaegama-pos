<?php

namespace App\Http\Controllers;

use App\Models\InventoryAudit;
use App\Models\InventoryAuditItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryAuditController extends Controller
{
    public function index()
    {
        return response()->json(InventoryAudit::with('items.stock:stock_id,description')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'loc_code' => 'required|exists:inventory_locations,loc_code',
            'notes' => 'nullable|string',
        ]);

        $data['audit_ref'] = 'AUD-' . strtoupper(Str::random(8));
        $data['status'] = 'open';
        $data['created_by'] = $request->user()->id ?? null;

        return response()->json(InventoryAudit::create($data), 201);
    }

    /**
     * Add/update a counted item on an open audit (scan-to-count).
     */
    public function addItem(Request $request, string $id)
    {
        $audit = InventoryAudit::find($id);
        if (!$audit) {
            return response()->json(['message' => 'Audit not found'], 404);
        }
        if ($audit->status !== 'open') {
            return response()->json(['message' => 'Audit is already completed'], 422);
        }

        $data = $request->validate([
            'stock_id' => 'required|exists:stock_master,stock_id',
            'counted_quantity' => 'required|numeric|min:0',
        ]);

        $systemQty = (float) (DB::table('loc_stock')
            ->where('stock_id', $data['stock_id'])
            ->where('loc_code', $audit->loc_code)
            ->value('quantity') ?? 0);

        $item = InventoryAuditItem::updateOrCreate(
            ['inventory_audit_id' => $audit->id, 'stock_id' => $data['stock_id']],
            [
                'system_quantity' => $systemQty,
                'counted_quantity' => $data['counted_quantity'],
                'variance' => $data['counted_quantity'] - $systemQty,
            ]
        );

        return response()->json($item->load('stock:stock_id,description'), 201);
    }

    /**
     * Complete the audit: adjust loc_stock to match every counted item.
     */
    public function complete(string $id)
    {
        $audit = InventoryAudit::with('items')->find($id);
        if (!$audit) {
            return response()->json(['message' => 'Audit not found'], 404);
        }
        if ($audit->status !== 'open') {
            return response()->json(['message' => 'Audit already completed'], 422);
        }
        if ($audit->items->isEmpty()) {
            return response()->json(['message' => 'Add at least one counted item first'], 422);
        }

        DB::transaction(function () use ($audit) {
            foreach ($audit->items as $item) {
                $exists = DB::table('loc_stock')
                    ->where('stock_id', $item->stock_id)
                    ->where('loc_code', $audit->loc_code)
                    ->exists();

                if ($exists) {
                    DB::table('loc_stock')
                        ->where('stock_id', $item->stock_id)
                        ->where('loc_code', $audit->loc_code)
                        ->update(['quantity' => $item->counted_quantity, 'updated_at' => now()]);
                } else {
                    DB::table('loc_stock')->insert([
                        'stock_id' => $item->stock_id,
                        'loc_code' => $audit->loc_code,
                        'quantity' => $item->counted_quantity,
                        'reorder_level' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            $audit->update(['status' => 'completed', 'completed_at' => now()]);
        });

        return response()->json($audit->fresh(['items.stock:stock_id,description']));
    }
}
