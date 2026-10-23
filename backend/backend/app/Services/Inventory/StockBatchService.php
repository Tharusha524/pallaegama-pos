<?php

namespace App\Services\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Keeps per-delivery stock batches (own purchase cost, selling price, MRP and
 * remaining qty) in step with every loc_stock change.
 *
 * Invariant: for each product + location, the sum of batch qty_remaining
 * equals loc_stock.quantity. Every change to loc_stock goes through
 * applyDelta() so the two never drift. Inventory value and COGS are NOT
 * affected — accounting keeps using the weighted average cost.
 */
class StockBatchService
{
    private const RETAIL_SALES_TYPE_ID = 3;

    /** Batch-log type for supermarket stock transfers (stock_transfers.id as trans_no). */
    public const TRANS_TRANSFER = 9016;

    private ?bool $enabled = null;

    public function enabled(): bool
    {
        return $this->enabled ??= Schema::hasTable('stock_batches') && Schema::hasTable('stock_batch_movements');
    }

    /**
     * Apply a stock quantity change to the batches of one product/location.
     *
     * $ctx keys (all optional):
     *  - batch_id      the batch the user picked (POS sale / damage / adjustment)
     *  - new_batch     [purchase_cost, selling_price, mrp] — a GRN line opens its own batch
     *  - from_source   [type, no] — GRN void: take from the batch that GRN created
     *  - restore_from  [type, no] — stock coming back: refill the batches that trans took from
     *  - undo_of       [type, no] — stock going out again: take from the batches that trans added to
     *  - clone_from    [type, no, loc_code] — transfer in: new batches with the prices of the batches it left
     *  - source_type, source_no, trans_type, trans_no, note — recorded on the batch / movement log
     *
     * @param  float  $prevQty  loc_stock quantity BEFORE this change (used to open a batch
     *                          for stock that existed before batches were introduced)
     * @param  array<string, mixed>  $ctx
     */
    public function applyDelta(string $stockId, string $locCode, float $delta, float $prevQty, array $ctx = []): void
    {
        if (! $this->enabled() || abs($delta) < 1e-9) {
            return;
        }
        $stockId = trim($stockId);
        $locCode = strtoupper(trim($locCode));
        if ($stockId === '' || $locCode === '') {
            return;
        }

        $this->ensureOpeningBatch($stockId, $locCode, $prevQty);

        if ($delta > 0) {
            $this->add($stockId, $locCode, $delta, $ctx);
        } else {
            $this->consume($stockId, $locCode, -$delta, $ctx);
        }
    }

    /**
     * Allocations a transaction made for a product, e.g. which batches a sale
     * delivery was taken from — used to put returned stock back where it came from.
     *
     * @return array<int, float> batch_id => qty (positive = taken out)
     */
    public function allocationsFor(int $transType, int $transNo, string $stockId, ?string $locCode = null): array
    {
        if (! $this->enabled()) {
            return [];
        }

        return DB::table('stock_batch_movements')
            ->where('trans_type', $transType)
            ->where('trans_no', $transNo)
            ->where('stock_id', $stockId)
            ->when($locCode !== null, fn ($q) => $q->where('loc_code', $locCode))
            ->groupBy('batch_id')
            ->selectRaw('batch_id, -SUM(qty) as qty')
            ->pluck('qty', 'batch_id')
            ->map(fn ($q) => (float) $q)
            ->all();
    }

    /**
     * Safety net: if anything changed loc_stock without going through applyDelta()
     * (old scripts, manual SQL), bring the batches back to the loc_stock total.
     * Shortage comes out FIFO, surplus goes into the newest batch.
     */
    public function syncToLocStock(string $stockId, string $locCode): void
    {
        if (! $this->enabled()) {
            return;
        }
        $stockId = trim($stockId);
        $locCode = strtoupper(trim($locCode));
        $locQty = (float) (DB::table('loc_stock')->where('stock_id', $stockId)->where('loc_code', $locCode)->value('quantity') ?? 0);
        $batches = $this->lockedBatches($stockId, $locCode);
        if ($batches->isEmpty()) {
            $this->ensureOpeningBatch($stockId, $locCode, $locQty);

            return;
        }
        $diff = round($locQty - (float) $batches->sum('qty_remaining'), 4);
        if (abs($diff) < 1e-6) {
            return;
        }
        $ctx = ['note' => 'Auto sync with stock qty'];
        $diff > 0 ? $this->add($stockId, $locCode, $diff, $ctx) : $this->consume($stockId, $locCode, -$diff, $ctx);
    }

    /**
     * What the POS can sell for a product: active batches with stock, grouped by
     * MRP — the one thing the cashier can see on the packet (oldest first). A
     * group's price is its newest batch's selling price; batch_id is its oldest
     * batch, so stock goes out first-in first-out within the group. The POS asks
     * the cashier only when there are 2 or more MRPs; otherwise the normal price
     * logic is used.
     *
     * @return list<array{batch_id: int, selling_price: float, mrp: float|null, qty: float, received_date: string|null}>
     */
    public function sellableGroups(string $stockId, ?string $locCode = null): array
    {
        if (! $this->enabled()) {
            return [];
        }
        $rows = DB::table('stock_batches')
            ->where('stock_id', trim($stockId))
            ->when($locCode !== null && trim($locCode) !== '', fn ($q) => $q->where('loc_code', strtoupper(trim($locCode))))
            ->where('status', 'active')
            ->where('qty_remaining', '>', 0)
            ->orderBy('id')
            ->get(['id', 'selling_price', 'mrp', 'qty_remaining', 'received_date']);

        $groups = [];
        foreach ($rows as $r) {
            $key = $this->mrpKey($r->mrp);
            if (! isset($groups[$key])) {
                $groups[$key] = [
                    'batch_id' => (int) $r->id,
                    'selling_price' => (float) $r->selling_price,
                    'mrp' => $r->mrp === null ? null : (float) $r->mrp,
                    'qty' => 0.0,
                    'received_date' => $r->received_date,
                ];
            }
            $groups[$key]['selling_price'] = (float) $r->selling_price;
            $groups[$key]['qty'] = round($groups[$key]['qty'] + (float) $r->qty_remaining, 4);
        }

        return array_values($groups);
    }

    /**
     * POS preload: only the products that currently have 2 or more different
     * MRPs in stock at a location (usually a handful), so the till can decide
     * instantly — with no extra call per scan — whether to ask the cashier.
     *
     * @return array<string, list<array{batch_id: int, selling_price: float, mrp: float|null, qty: float, received_date: string|null}>>
     */
    public function multiPriceProducts(?string $locCode = null): array
    {
        if (! $this->enabled()) {
            return [];
        }
        $loc = $locCode !== null && trim($locCode) !== '' ? strtoupper(trim($locCode)) : null;

        $multi = DB::table('stock_batches')
            ->where('status', 'active')->where('qty_remaining', '>', 0)
            ->when($loc !== null, fn ($q) => $q->where('loc_code', $loc))
            ->groupBy('stock_id')
            ->havingRaw('COUNT(DISTINCT ROUND(COALESCE(mrp, -1), 2)) > 1')
            ->pluck('stock_id');

        $out = [];
        foreach ($multi as $stockId) {
            $out[(string) $stockId] = $this->sellableGroups((string) $stockId, $loc);
        }

        return $out;
    }

    /**
     * Product price / MRP was changed (Set Price, MRP setup, bulk price upload, a
     * GRN at the same MRP): the batches of the packets that price is for follow it,
     * so the same packets never show up as two prices at the till.
     *
     * Those are the active batches with the old MRP (by default the current one);
     * when the product has only one MRP in stock, all its active batches. Batches
     * with a different MRP (older / newer packets) keep their own price.
     */
    public function followProductPrice(string $stockId, mixed $oldMrp = false): void
    {
        if (! $this->enabled()) {
            return;
        }
        $stockId = trim($stockId);
        $stock = DB::table('stock_master')->where('stock_id', $stockId)->first(['mrp_price']);
        if (! $stock) {
            return;
        }
        $price = (float) (DB::table('sales_pricing')
            ->where('stock_id', $stockId)->where('sales_type_id', self::RETAIL_SALES_TYPE_ID)->where('currency_id', 8)
            ->value('price') ?? 0);
        $currentMrp = $stock->mrp_price === null ? null : (float) $stock->mrp_price;

        $active = DB::table('stock_batches')->where('stock_id', $stockId)->where('status', 'active')->get(['id', 'mrp']);
        if ($active->isEmpty()) {
            return;
        }
        $matchKey = $this->mrpKey($oldMrp === false ? $currentMrp : $oldMrp);
        $ids = $active->filter(fn ($b) => $this->mrpKey($b->mrp) === $matchKey)->pluck('id');
        if ($ids->isEmpty() && $active->map(fn ($b) => $this->mrpKey($b->mrp))->unique()->count() <= 1) {
            $ids = $active->pluck('id');
        }
        if ($ids->isEmpty()) {
            return;
        }

        $update = ['mrp' => $currentMrp, 'updated_at' => now()];
        if ($price > 0) {
            $update['selling_price'] = $price;
        }
        DB::table('stock_batches')->whereIn('id', $ids->all())->update($update);
    }

    /**
     * POS: stock that has no price yet (new-cost deliveries waiting for Set Price),
     * per product at a location — the till must not sell it.
     *
     * @return array<string, float>
     */
    public function pendingQtyByProduct(?string $locCode = null): array
    {
        if (! $this->enabled()) {
            return [];
        }
        $loc = $locCode !== null && trim($locCode) !== '' ? strtoupper(trim($locCode)) : null;

        return DB::table('stock_batches')
            ->where('status', 'pending')->where('qty_remaining', '>', 0)
            ->when($loc !== null, fn ($q) => $q->where('loc_code', $loc))
            ->groupBy('stock_id')
            ->selectRaw('stock_id, SUM(qty_remaining) as qty')
            ->pluck('qty', 'stock_id')
            ->map(fn ($q) => (float) $q)
            ->all();
    }

    /**
     * A batch got its price on Set Price. If it is the product's newest selling batch,
     * that price / MRP becomes the product's current price too — so a single-price
     * till sale (no popup) charges it once the older stock is sold out.
     */
    public function batchPriced(int $batchId): void
    {
        $b = DB::table('stock_batches')->where('id', $batchId)->first();
        if (! $b || $b->status !== 'active' || (float) $b->selling_price <= 0) {
            return;
        }
        $newest = DB::table('stock_batches')->where('stock_id', $b->stock_id)->where('status', 'active')->max('id');
        if ((int) $newest !== (int) $b->id) {
            return;
        }
        $row = DB::table('sales_pricing')->where('stock_id', $b->stock_id)
            ->where('sales_type_id', self::RETAIL_SALES_TYPE_ID)->where('currency_id', 8)->first();
        if ($row) {
            DB::table('sales_pricing')->where('id', $row->id)->update(['price' => (float) $b->selling_price, 'updated_at' => now()]);
        } else {
            DB::table('sales_pricing')->insert([
                'stock_id' => $b->stock_id, 'sales_type_id' => self::RETAIL_SALES_TYPE_ID, 'currency_id' => 8,
                'price' => (float) $b->selling_price, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        if ($b->mrp !== null) {
            DB::table('stock_master')->where('stock_id', $b->stock_id)->update(['mrp_price' => (float) $b->mrp, 'updated_at' => now()]);
        }
    }

    /** Create opening batches for all existing stock that has none yet. Safe to run again. */
    public function openAllExistingStock(): int
    {
        if (! $this->enabled()) {
            return 0;
        }
        $created = 0;
        $rows = DB::table('loc_stock')->where('quantity', '!=', 0)->get(['stock_id', 'loc_code', 'quantity']);
        foreach ($rows as $row) {
            DB::transaction(function () use ($row, &$created) {
                if ($this->ensureOpeningBatch((string) $row->stock_id, strtoupper((string) $row->loc_code), (float) $row->quantity)) {
                    $created++;
                }
            });
        }

        return $created;
    }

    // ------------------------------------------------------------------

    private function ensureOpeningBatch(string $stockId, string $locCode, float $prevQty): bool
    {
        $exists = DB::table('stock_batches')
            ->where('stock_id', $stockId)
            ->where('loc_code', $locCode)
            ->lockForUpdate()
            ->exists();
        if ($exists || abs($prevQty) < 1e-9) {
            return false;
        }

        $defaults = $this->currentPrices($stockId);
        $id = $this->createBatch($stockId, $locCode, $prevQty, [
            'source_type' => 'opening',
            'purchase_cost' => $defaults['purchase_cost'],
            'selling_price' => $defaults['selling_price'],
            'mrp' => $defaults['mrp'],
        ]);
        $this->log($id, $stockId, $locCode, $prevQty, null, null, 'Opening stock');

        return true;
    }

    private function add(string $stockId, string $locCode, float $qty, array $ctx): void
    {
        $batches = $this->lockedBatches($stockId, $locCode);

        // A delivery (GRN):
        //  - selling price / MRP typed on the purchase: added to a selling batch with the
        //    same cost + price + MRP, else a new batch at those prices;
        //  - left blank (the normal case — only the cost is entered): added to the batch
        //    with the same cost, else a NEW batch with NO price ("pending"). The till does
        //    not sell a pending batch until its price is set on the Set Price page.
        if (array_key_exists('new_batch', $ctx) && $ctx['new_batch'] !== null) {
            // First cover any oversold (negative) batches so they don't linger below zero.
            foreach ($batches as $b) {
                if ($qty <= 1e-9) {
                    break;
                }
                if ((float) $b->qty_remaining < -1e-9) {
                    $cover = min($qty, -(float) $b->qty_remaining);
                    $this->changeQty($b, $cover);
                    $this->log($b->id, $stockId, $locCode, $cover, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, 'Covered oversold qty');
                    $qty -= $cover;
                }
            }
            if ($qty <= 1e-9) {
                return;
            }
            $defaults = $this->currentPrices($stockId);
            $nb = $ctx['new_batch'];
            $cost = $this->num($nb['purchase_cost'] ?? null) ?? $defaults['purchase_cost'];
            $typedPrice = $this->num($nb['selling_price'] ?? null);
            $typedMrp = $this->num($nb['mrp'] ?? null);

            if ($typedPrice === null && $typedMrp === null) {
                $same = $batches->filter(fn ($b) => in_array($b->status, ['active', 'pending'], true)
                    && $this->money($b->purchase_cost) === $this->money($cost))->sortByDesc('id')->first();
                if ($same) {
                    DB::table('stock_batches')->where('id', $same->id)->update([
                        'qty_received' => round((float) $same->qty_received + $qty, 4),
                    ]);
                    $this->changeQty($same, $qty);
                    $this->log($same->id, $stockId, $locCode, $qty, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? 'Added to same-cost batch');

                    return;
                }
                $id = $this->createBatch($stockId, $locCode, $qty, [
                    'source_type' => $ctx['source_type'] ?? 'grn',
                    'source_no' => $ctx['source_no'] ?? null,
                    'purchase_cost' => $cost,
                    'selling_price' => 0,
                    'mrp' => null,
                    'status' => 'pending',
                ]);
                $this->log($id, $stockId, $locCode, $qty, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? 'New cost — price not set yet');

                return;
            }

            $price = $typedPrice ?? $defaults['selling_price'];
            $mrp = $typedMrp ?? $defaults['mrp'];

            $same = $batches->first(fn ($b) => $b->status === 'active'
                && $this->money($b->purchase_cost) === $this->money($cost)
                && $this->money($b->selling_price) === $this->money($price)
                && $this->mrpKey($b->mrp) === $this->mrpKey($mrp));
            if ($same) {
                DB::table('stock_batches')->where('id', $same->id)->update([
                    'qty_received' => round((float) $same->qty_received + $qty, 4),
                ]);
                $this->changeQty($same, $qty);
                $this->log($same->id, $stockId, $locCode, $qty, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? 'Added to same-price batch');

                return;
            }

            $id = $this->createBatch($stockId, $locCode, $qty, [
                'source_type' => $ctx['source_type'] ?? 'grn',
                'source_no' => $ctx['source_no'] ?? null,
                'purchase_cost' => $cost,
                'selling_price' => $price,
                'mrp' => $mrp,
            ]);
            $this->log($id, $stockId, $locCode, $qty, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);

            return;
        }

        // Transfer in: one new batch per source batch, keeping its cost / price / MRP.
        if (! empty($ctx['clone_from']['type']) && ! empty($ctx['clone_from']['no'])) {
            $fromLoc = strtoupper(trim((string) ($ctx['clone_from']['loc_code'] ?? '')));
            $taken = $this->allocationsFor((int) $ctx['clone_from']['type'], (int) $ctx['clone_from']['no'], $stockId, $fromLoc !== '' ? $fromLoc : null);
            foreach ($taken as $batchId => $takenQty) {
                if ($qty <= 1e-9) {
                    break;
                }
                $src = DB::table('stock_batches')->where('id', (int) $batchId)->first();
                if (! $src || $takenQty <= 1e-9) {
                    continue;
                }
                $part = min($qty, $takenQty);
                $id = $this->createBatch($stockId, $locCode, $part, [
                    'source_type' => $ctx['source_type'] ?? 'transfer',
                    'source_no' => $ctx['source_no'] ?? null,
                    'purchase_cost' => $src->purchase_cost,
                    'selling_price' => $src->selling_price,
                    'mrp' => $src->mrp,
                    'status' => $src->status === 'pending' ? 'pending' : null,
                ]);
                $this->log($id, $stockId, $locCode, $part, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);
                $qty -= $part;
            }
            if ($qty <= 1e-9) {
                return;
            }
        }

        // Stock coming back from an earlier transaction (sale void / customer return):
        // put it back into the batches that transaction took it from.
        if (! empty($ctx['restore_from']['type']) && ! empty($ctx['restore_from']['no'])) {
            $taken = $this->allocationsFor((int) $ctx['restore_from']['type'], (int) $ctx['restore_from']['no'], $stockId, $locCode);
            foreach ($taken as $batchId => $takenQty) {
                if ($qty <= 1e-9) {
                    break;
                }
                $b = $batches->firstWhere('id', (int) $batchId);
                if (! $b || $takenQty <= 1e-9) {
                    continue;
                }
                $back = min($qty, $takenQty);
                $this->changeQty($b, $back);
                $this->log($b->id, $stockId, $locCode, $back, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);
                $qty -= $back;
            }
            if ($qty <= 1e-9) {
                return;
            }
        }

        // Otherwise put it back into a specific batch (return / void / transfer in) ...
        $target = null;
        if (! empty($ctx['batch_id'])) {
            $target = $batches->firstWhere('id', (int) $ctx['batch_id']);
        }
        // ... or the newest still-selling batch (a sold-out price is not revived), else the newest.
        $target ??= $batches->where('status', 'active')->sortByDesc('id')->first()
            ?? $batches->sortByDesc('id')->first();

        if (! $target) {
            $defaults = $this->currentPrices($stockId);
            $id = $this->createBatch($stockId, $locCode, $qty, [
                'source_type' => $ctx['source_type'] ?? 'adjustment',
                'source_no' => $ctx['source_no'] ?? null,
                'purchase_cost' => $this->num($ctx['purchase_cost'] ?? null) ?? $defaults['purchase_cost'],
                'selling_price' => $this->num($ctx['selling_price'] ?? null) ?? $defaults['selling_price'],
                'mrp' => $this->num($ctx['mrp'] ?? null) ?? $defaults['mrp'],
            ]);
            $this->log($id, $stockId, $locCode, $qty, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);

            return;
        }

        $this->changeQty($target, $qty);
        $this->log($target->id, $stockId, $locCode, $qty, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);
    }

    private function consume(string $stockId, string $locCode, float $qty, array $ctx): void
    {
        $batches = $this->lockedBatches($stockId, $locCode);
        if ($batches->isEmpty()) {
            // Stock going below zero with nothing on record: keep the invariant with a
            // negative opening batch so sum(batches) still equals loc_stock.
            $defaults = $this->currentPrices($stockId);
            $id = $this->createBatch($stockId, $locCode, -$qty, [
                'source_type' => 'opening',
                'purchase_cost' => $defaults['purchase_cost'],
                'selling_price' => $defaults['selling_price'],
                'mrp' => $defaults['mrp'],
            ]);
            $this->log($id, $stockId, $locCode, -$qty, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);

            return;
        }

        $preferred = ! empty($ctx['batch_id']) ? $batches->firstWhere('id', (int) $ctx['batch_id']) : null;
        $fromSource = null;
        if (! empty($ctx['from_source']['type'])) {
            $fromSource = $batches->first(fn ($b) => $b->source_type === $ctx['from_source']['type']
                && (int) $b->source_no === (int) $ctx['from_source']['no']);
        }

        // Order: the chosen batch, other batches with the same MRP, the batches the
        // transaction being voided added to, then the oldest remaining stock first (FIFO).
        $ordered = collect();
        if ($preferred) {
            $ordered->push($preferred);
            $ordered = $ordered->merge($batches->filter(fn ($b) => $b->id !== $preferred->id
                && $this->mrpKey($b->mrp) === $this->mrpKey($preferred->mrp))->sortBy('id'));
        }
        if (! empty($ctx['undo_of']['type']) && ! empty($ctx['undo_of']['no'])) {
            $added = $this->allocationsFor((int) $ctx['undo_of']['type'], (int) $ctx['undo_of']['no'], $stockId, $locCode);
            foreach ($added as $batchId => $takenQty) {
                $b = $batches->firstWhere('id', (int) $batchId);
                if ($b && $takenQty < -1e-9 && ! $ordered->contains('id', $b->id)) {
                    $ordered->push($b);
                }
            }
        }
        if ($fromSource && ! $ordered->contains('id', $fromSource->id)) {
            $ordered->push($fromSource);
        }
        $ordered = $ordered->merge($batches->filter(fn ($b) => ! $ordered->contains('id', $b->id)
            && ! in_array($b->status, ['inactive', 'pending'], true))->sortBy('id'));
        $ordered = $ordered->merge($batches->filter(fn ($b) => ! $ordered->contains('id', $b->id))->sortBy('id'));

        $remaining = $qty;
        $last = null;
        foreach ($ordered as $b) {
            if ($remaining <= 1e-9) {
                break;
            }
            $available = (float) $b->qty_remaining;
            if ($available <= 1e-9) {
                continue;
            }
            $take = min($available, $remaining);
            // Voided delivery: it was never really received into this batch.
            if (! empty($ctx['undo_receipt']) && $this->addedBy($ctx['undo_of'] ?? null, $stockId, $locCode, (int) $b->id)) {
                DB::table('stock_batches')->where('id', $b->id)
                    ->update(['qty_received' => round(max(0, (float) $b->qty_received - $take), 4)]);
                $b->qty_received = max(0, (float) $b->qty_received - $take);
            }
            $this->changeQty($b, -$take);
            $this->log($b->id, $stockId, $locCode, -$take, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);
            $remaining -= $take;
            $last = $b;
        }

        // More than the batches hold (stock going negative, as loc_stock allows):
        // take the rest from the chosen/last batch so the totals stay equal.
        if ($remaining > 1e-9) {
            $b = $preferred ?? $last ?? $ordered->last();
            $this->changeQty($b, -$remaining);
            $this->log($b->id, $stockId, $locCode, -$remaining, $ctx['trans_type'] ?? null, $ctx['trans_no'] ?? null, $ctx['note'] ?? null);
        }
    }

    private function lockedBatches(string $stockId, string $locCode)
    {
        return DB::table('stock_batches')
            ->where('stock_id', $stockId)
            ->where('loc_code', $locCode)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    private function changeQty(object $batch, float $delta): void
    {
        $newQty = round((float) $batch->qty_remaining + $delta, 4);
        $status = $batch->status;
        if ($status === 'pending') {
            $status = $newQty > 1e-9 ? 'pending' : 'finished';
        } elseif ($status !== 'inactive') {
            $status = $newQty > 1e-9 ? 'active' : 'finished';
        }
        DB::table('stock_batches')->where('id', $batch->id)->update([
            'qty_remaining' => $newQty,
            'status' => $status,
            'updated_at' => now(),
        ]);
        // keep the in-memory copy current for the rest of this call
        $batch->qty_remaining = $newQty;
        $batch->status = $status;
    }

    private function createBatch(string $stockId, string $locCode, float $qty, array $data): int
    {
        return (int) DB::table('stock_batches')->insertGetId([
            'stock_id' => $stockId,
            'loc_code' => $locCode,
            'source_type' => $data['source_type'] ?? 'opening',
            'source_no' => $data['source_no'] ?? null,
            'purchase_cost' => round((float) ($data['purchase_cost'] ?? 0), 4),
            'selling_price' => round((float) ($data['selling_price'] ?? 0), 4),
            'mrp' => isset($data['mrp']) ? round((float) $data['mrp'], 4) : null,
            'qty_received' => round(max($qty, 0), 4),
            'qty_remaining' => round($qty, 4),
            'status' => $qty > 1e-9 ? ($data['status'] ?? 'active') : 'finished',
            'received_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function log(int $batchId, string $stockId, string $locCode, float $qty, ?int $transType, ?int $transNo, ?string $note): void
    {
        DB::table('stock_batch_movements')->insert([
            'batch_id' => $batchId,
            'stock_id' => $stockId,
            'loc_code' => $locCode,
            'qty' => round($qty, 4),
            'trans_type' => $transType,
            'trans_no' => $transNo,
            'note' => $note !== null ? mb_substr($note, 0, 100) : null,
            'created_at' => now(),
        ]);
    }

    /** @return array{purchase_cost: float, selling_price: float, mrp: float|null} */
    private function currentPrices(string $stockId): array
    {
        $stock = DB::table('stock_master')->where('stock_id', $stockId)->first(['material_cost', 'purchase_cost', 'mrp_price']);
        $price = DB::table('sales_pricing')
            ->where('stock_id', $stockId)
            ->where('sales_type_id', self::RETAIL_SALES_TYPE_ID)
            ->orderByDesc('id')
            ->value('price');
        $cost = (float) ($stock->material_cost ?? 0);
        if ($cost <= 0) {
            $cost = (float) ($stock->purchase_cost ?? 0);
        }

        return [
            'purchase_cost' => $cost,
            'selling_price' => (float) ($price ?? 0),
            'mrp' => isset($stock->mrp_price) && $stock->mrp_price !== null ? (float) $stock->mrp_price : null,
        ];
    }

    /** Did transaction [type, no] add stock into this batch (and not take it back yet)? */
    private function addedBy(?array $trans, string $stockId, string $locCode, int $batchId): bool
    {
        if (empty($trans['type']) || empty($trans['no'])) {
            return false;
        }
        $net = $this->allocationsFor((int) $trans['type'], (int) $trans['no'], $stockId, $locCode)[$batchId] ?? 0;

        return $net < -1e-9; // allocationsFor() reports additions as negative
    }

    private function money(mixed $v): string
    {
        return number_format((float) $v, 2, '.', '');
    }

    private function mrpKey(mixed $mrp): string
    {
        return $mrp === null ? 'none' : number_format((float) $mrp, 2, '.', '');
    }

    private function num(mixed $v): ?float
    {
        return ($v === null || $v === '' || ! is_numeric($v)) ? null : (float) $v;
    }
}
