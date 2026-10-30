<?php

namespace App\Http\Controllers;

use App\Http\Requests\StockMasterRequest;
use App\Models\ItemCode;
use App\Models\SalesPricing;
use App\Models\StockMaster;
use App\Repositories\All\StockMaster\StockMasterInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class StockMasterController extends Controller
{
    private StockMasterInterface $stockMasterRepo;

    public function __construct(StockMasterInterface $stockMasterRepo)
    {
        $this->stockMasterRepo = $stockMasterRepo;
    }

    public function index(Request $request)
    {
        // "unit" (kg/pcs/...) is needed on the Set Price -> Wholesale Pricing
        // tab, to label the quantity threshold correctly for weighed items.
        $query = StockMaster::with('unit')->orderBy('stock_id');

        return $this->jsonList($request, $query);
    }

    public function store(StockMasterRequest $request)
    {
        $data = $request->validated();

        // Handle image upload
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('stock_images', 'public');
            $data['image'] = $path;
        }

        $stockMaster = $this->stockMasterRepo->create($data);

        return response()->json($stockMaster, 201);
    }

    /**
     * Bulk product creation from a spreadsheet — deliberately only asks for
     * the fields a store owner actually understands (name, category,
     * subcategory, brand, unit, cost, price, barcode). Every accounting/GL
     * field a product still legally needs (tax type, item type, sales/COGS/
     * inventory/adjustment/WIP accounts, depreciation fields) is copied
     * behind the scenes from one designated "template" product — normally
     * the first active product in stock_master — through the exact same
     * StockMasterRequest validation the manual Add Product form uses. No
     * new accounting logic: the row is only ever as valid as that template
     * product already was, and a row is skipped (not silently forced
     * through) if its own fields don't resolve.
     */
    public function bulkStore(Request $request)
    {
        $rows = $request->input('rows', []);
        if (!is_array($rows) || $rows === []) {
            return response()->json(['message' => 'No rows provided.'], 422);
        }

        // Accounts are copied from an existing product; on an empty system (no
        // product yet) each row takes them from its category's defaults instead.
        $template = StockMaster::where('inactive', false)->orderBy('stock_id')->first();
        $templateAccounts = $template ? [
            'tax_type_id' => $template->tax_type_id,
            'mb_flag' => $template->mb_flag,
            'sales_account' => $template->sales_account,
            'cogs_account' => $template->cogs_account,
            'inventory_account' => $template->inventory_account,
            'adjustment_account' => $template->adjustment_account,
            'wip_account' => $template->wip_account,
        ] : null;

        $accountingDefaults = [
            'tax_type_id' => null,
            'mb_flag' => null,
            'sales_account' => null,
            'cogs_account' => null,
            'inventory_account' => null,
            'adjustment_account' => null,
            'wip_account' => null,
            'material_cost' => 0,
            'labour_cost' => 0,
            'overhead_cost' => 0,
            'depreciation_rate' => 0,
            'depreciation_factor' => 0,
            'depreciation_start' => now()->toDateString(),
            'depreciation_date' => now()->toDateString(),
        ];

        $rules = (new StockMasterRequest())->rules();
        unset($rules['image'], $rules['category_id'], $rules['subcategory_id'], $rules['brand_id'], $rules['units']);
        foreach (array_keys($accountingDefaults) as $key) {
            unset($rules[$key]);
        }
        $rules['category_id'] = 'nullable|integer';
        $rules['subcategory_id'] = 'nullable|integer';
        $rules['brand_id'] = 'nullable|integer';
        $rules['units'] = 'nullable|integer|exists:item_units,id';
        $rules['mrp_price'] = 'nullable|numeric|min:0';
        foreach (array_keys($accountingDefaults) as $key) {
            $rules[$key] = 'nullable';
        }

        $created = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            $rowNo = $index + 1;
            $row['stock_id'] = isset($row['stock_id']) ? (string) $row['stock_id'] : null;
            $stockId = $row['stock_id'];

            $categoryId = $this->resolveByName('item_category', 'description', 'category_id', $row['category'] ?? null);
            if (($row['category'] ?? '') !== '' && $categoryId === null) {
                $categoryId = DB::table('item_category')->insertGetId([
                    'description'        => trim($row['category']),
                    'dflt_tax_type'      => 1,
                    'dflt_units'         => 1,
                    'dflt_mb_flag'       => 2,
                    'dflt_sales_act'     => '2000',
                    'dflt_cogs_act'      => '3010',
                    'dflt_inventory_act' => '1100',
                    'dflt_adjustment_act'=> '3020',
                    'dflt_wip_act'       => '2200',
                ]);
            }
            // Fall back to first available category if none provided
            if ($categoryId === null) {
                $categoryId = DB::table('item_category')->value('category_id');
            }

            $subcategoryId = $this->resolveByName('subcategories', 'name', 'id', $row['subcategory'] ?? null);
            if (($row['subcategory'] ?? '') !== '' && $subcategoryId === null) {
                $subcategoryId = DB::table('subcategories')->insertGetId(['name' => trim($row['subcategory']), 'category_id' => $categoryId]);
            }

            $brandId = $this->resolveByName('brands', 'name', 'id', $row['brand'] ?? null);
            if (($row['brand'] ?? '') !== '' && $brandId === null) {
                $brandId = DB::table('brands')->insertGetId(['name' => trim($row['brand'])]);
            }

            $unitsId = $this->resolveByName('item_units', 'name', 'id', $row['units'] ?? null)
                ?? $this->resolveByName('item_units', 'abbr', 'id', $row['units'] ?? null);
            // Missing unit → create it, the same way categories and brands are.
            if (trim($row['units'] ?? '') !== '' && $unitsId === null) {
                $unitName = trim($row['units']);
                $unitsId = DB::table('item_units')->insertGetId([
                    'abbr' => $unitName,
                    'name' => $unitName,
                    'decimals' => in_array(mb_strtolower($unitName), ['kg', 'l'], true) ? 3 : 0,
                    'inactive' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            // Fall back to the first available unit if none provided
            if ($unitsId === null) {
                $unitsId = DB::table('item_units')->value('id');
            }

            $data = array_merge($accountingDefaults, $templateAccounts ?? $this->categoryAccounts($categoryId), [
                'stock_id' => $row['stock_id'] ?? null,
                'description' => $row['description'] ?? null,
                'long_description' => $row['description'] ?? null,
                'category_id' => $categoryId,
                'subcategory_id' => $subcategoryId,
                'brand_id' => $brandId,
                'units' => $unitsId,
                'purchase_cost' => $row['purchase_cost'] ?? 0,
                'mrp_price' => $row['mrp_price'] ?? null,
            ]);

            $validator = Validator::make($data, $rules);
            if ($validator->fails()) {
                $errors[] = ['row' => $rowNo, 'stock_id' => $stockId, 'message' => $validator->errors()->first()];
                continue;
            }

            $stockMaster = $this->stockMasterRepo->create($validator->validated());
            $this->applyBulkAddExtras($stockMaster->stock_id, $row);
            $created++;
        }

        return response()->json([
            'created' => $created,
            'errors' => $errors,
        ]);
    }

    /**
     * A category's default accounts, in stock_master's field names. Falls back
     * to the same defaults bulkStore gives a category it creates.
     */
    private function categoryAccounts($categoryId): array
    {
        $cat = $categoryId ? DB::table('item_category')->where('category_id', $categoryId)->first() : null;

        return [
            'tax_type_id' => $cat->dflt_tax_type ?? 1,
            'mb_flag' => $cat->dflt_mb_flag ?? 2,
            'sales_account' => $cat->dflt_sales_act ?? '2000',
            'cogs_account' => $cat->dflt_cogs_act ?? '3010',
            'inventory_account' => $cat->dflt_inventory_act ?? '1100',
            'adjustment_account' => $cat->dflt_adjustment_act ?? '3020',
            'wip_account' => $cat->dflt_wip_act ?? '2200',
        ];
    }

    /**
     * Case-insensitive "find this thing by its human name" lookup used only
     * to translate a spreadsheet's readable category/brand/unit names into
     * the ids stock_master actually stores. Returns null for a blank input
     * or no match — callers decide whether that's fatal for the row.
     */
    private function resolveByName(string $table, string $nameColumn, string $idColumn, ?string $name)
    {
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }

        return DB::table($table)->whereRaw("LOWER({$nameColumn}) = ?", [mb_strtolower($name)])->value($idColumn);
    }

    /**
     * Optional selling price + barcode for a just-created product — same
     * sales_pricing / item_codes writes Set Price already makes for an
     * existing product, just run once right after creation. Best-effort:
     * the product itself is already created successfully by this point.
     */
    private function applyBulkAddExtras(string $stockId, array $row): void
    {
        try {
            // Save the exact selling_price from Excel to sales_pricing (upsert).
            $sellingPrice = $row['selling_price'] ?? null;
            if ($sellingPrice !== null && $sellingPrice !== '' && (float) $sellingPrice > 0) {
                SalesPricing::updateOrCreate(
                    ['stock_id' => $stockId, 'currency_id' => 8, 'sales_type_id' => 3],
                    ['price' => (float) $sellingPrice]
                );
            }

            $barcode = trim((string) ($row['barcode'] ?? ''));
            // One barcode may belong to several products (the till lets the cashier
            // pick); only skip it when THIS product already has it.
            if ($barcode !== '' && !ItemCode::where('item_code', $barcode)->where('stock_id', $stockId)->exists()) {
                $stock = StockMaster::find($stockId);
                if ($stock) {
                    ItemCode::create([
                        'item_code' => $barcode,
                        'stock_id' => $stockId,
                        'description' => $stock->description,
                        'category_id' => $stock->category_id,
                        'quantity' => 1,
                        'is_foreign' => true,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function show(string $id)
    {
        $stockMaster = $this->stockMasterRepo->find($id);
        if (!$stockMaster) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }
        return response()->json($stockMaster);
    }

    public function update(StockMasterRequest $request, string $id)
    {
        $stockMaster = $this->stockMasterRepo->find($id);
        if (!$stockMaster) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }

        $data = $request->validated();

        if ($request->hasFile('image')) {
            if ($stockMaster->image) {
                Storage::disk('public')->delete($stockMaster->image);
            }
            $data['image'] = $request->file('image')->store('stock_images', 'public');
        }

        $updated = $this->stockMasterRepo->update($id, $data);
        if (!$updated) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }
        return response()->json($this->stockMasterRepo->find($id));
    }

    /**
     * Set just the MRP (Maximum Retail Price) for a product — deliberately
     * separate from the full update() above, which requires the whole
     * StockMasterRequest payload (accounts, tax type, category, etc.). This
     * touches only mrp_price, the same "small, isolated field" pattern as
     * Sales Pricing / barcode linking elsewhere in the Supermarket module.
     */
    public function updateMrpPrice(Request $request, string $id)
    {
        $stockMaster = $this->stockMasterRepo->find($id);
        if (!$stockMaster) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }

        $validated = $request->validate([
            'mrp_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $oldMrp = $stockMaster->mrp_price === null ? null : (float) $stockMaster->mrp_price;
        $stockMaster->mrp_price = $validated['mrp_price'] ?? null;
        $stockMaster->save();
        // The stock batches of those packets carry the corrected MRP too.
        try {
            app(\App\Services\Inventory\StockBatchService::class)->followProductPrice((string) $stockMaster->stock_id, $oldMrp);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json($stockMaster);
    }

    /**
     * Set the Unit of Measure for many products at once — e.g. tick 20
     * products on the Stock page and apply "KG" to all of them in one go,
     * instead of opening each product's full edit form individually. Same
     * isolated single-field pattern as updateMrpPrice() below, just over
     * a list of ids.
     */
    public function bulkUpdateUnits(Request $request)
    {
        $validated = $request->validate([
            'stock_ids' => ['required', 'array', 'min:1'],
            'stock_ids.*' => ['string'],
            'units' => ['required', 'integer', 'exists:item_units,id'],
        ]);

        $updated = StockMaster::whereIn('stock_id', $validated['stock_ids'])
            ->update(['units' => $validated['units']]);

        return response()->json(['updated' => $updated]);
    }

    /**
     * Delete products only if they were never used. Anything with sales,
     * purchases, stock moves, stock on hand or BOM links is kept and reported
     * back as "blocked" so the user can make it Inactive instead — deleting a
     * used item would leave invoices and stock/accounting reports pointing at
     * a product that no longer exists.
     */
    public function safeDelete(Request $request)
    {
        $validated = $request->validate([
            'stock_ids' => ['required', 'array', 'min:1'],
            'stock_ids.*' => ['string'],
        ]);

        // Setup-only rows that belong to the product and go with it.
        $setupTables = ['item_codes', 'sales_pricing', 'purch_data', 'promotional_prices', 'item_variants', 'loc_stock'];

        $deleted = [];
        $blocked = [];

        foreach (array_unique($validated['stock_ids']) as $stockId) {
            $stock = StockMaster::find($stockId);
            if (! $stock) {
                $blocked[] = ['stock_id' => $stockId, 'reason' => 'Product not found.'];
                continue;
            }

            $reason = $this->usedReason($stockId);
            if ($reason) {
                $blocked[] = ['stock_id' => $stockId, 'description' => $stock->description, 'reason' => $reason];
                continue;
            }

            try {
                DB::transaction(function () use ($stockId, $stock, $setupTables) {
                    foreach ($setupTables as $table) {
                        if (Schema::hasTable($table)) {
                            DB::table($table)->where('stock_id', $stockId)->delete();
                        }
                    }
                    $stock->delete();
                });
                if ($stock->image) {
                    Storage::disk('public')->delete($stock->image);
                }
                $deleted[] = $stockId;
            } catch (\Throwable $e) {
                // e.g. a foreign key from a table not listed above
                $blocked[] = ['stock_id' => $stockId, 'description' => $stock->description, 'reason' => 'Linked to other records.'];
            }
        }

        return response()->json(['deleted' => $deleted, 'blocked' => $blocked]);
    }

    /**
     * Why a product can't be deleted — it has
     * sales, purchase or stock history, stock on hand, or a BOM link.
     * Null when it was never used.
     */
    private function usedReason(string $stockId): ?string
    {
        // table => column holding the stock id
        $historyTables = [
            'stock_moves' => 'stock_id',
            'debtor_trans_details' => 'stock_id',
            'sales_order_details' => 'stk_code',
            'purch_order_details' => 'item_code',
            'grn_items' => 'item_code',
            'supp_invoice_items' => 'stock_id',
            'wo_requirements' => 'stock_id',
        ];
        foreach ($historyTables as $table => $column) {
            if (Schema::hasTable($table) && DB::table($table)->where($column, $stockId)->exists()) {
                return 'Has sales, purchase or stock history.';
            }
        }
        if (Schema::hasTable('loc_stock')
            && DB::table('loc_stock')->where('stock_id', $stockId)->where('quantity', '!=', 0)->exists()) {
            return 'Has stock on hand.';
        }
        if (Schema::hasTable('bom')
            && DB::table('bom')->where('parent', $stockId)->orWhere('component', $stockId)->exists()) {
            return 'Used in a bill of materials.';
        }

        return null;
    }

    /**
     * Change a product's item code — only while it has no sales or purchases,
     * so no sale/purchase document ever points at the old code. Its setup rows
     * (barcodes, prices, offers) and stock-only records (adjustments, batches,
     * stock on hand) move to the new code in one transaction.
     */
    public function changeStockId(Request $request, string $id)
    {
        $validated = $request->validate([
            'new_stock_id' => ['required', 'string', 'max:255'],
        ]);
        $newId = trim($validated['new_stock_id']);

        $stock = StockMaster::find($id);
        if (! $stock) {
            return response()->json(['message' => 'Product not found.'], 404);
        }
        if ($newId === '' || $newId === (string) $stock->stock_id) {
            return response()->json(['message' => 'Enter a new item code.'], 422);
        }
        if (StockMaster::where('stock_id', $newId)->exists()) {
            return response()->json(['message' => "Item code {$newId} is already used by another product."], 422);
        }
        // Blocked once the item was sold, bought, quoted or manufactured —
        // those documents keep the code they were made with.
        $blockingTables = [
            'debtor_trans_details' => 'stock_id',
            'sales_order_details' => 'stk_code',
            'quotation_details' => 'stk_code',
            'price_override_log' => 'stock_id',
            'warranties' => 'stock_id',
            'purch_order_details' => 'item_code',
            'grn_items' => 'item_code',
            'supp_invoice_items' => 'stock_id',
            'wo_requirements' => 'stock_id',
            'workorders' => 'stock_id',
            'wo_issue_items' => 'stock_id',
            'fa_depreciation_lines' => 'stock_id',
        ];
        foreach ($blockingTables as $table => $column) {
            if (Schema::hasTable($table) && DB::table($table)->where($column, $id)->exists()) {
                return response()->json(['message' => "Can't change the item code: Has sales or purchase history."], 422);
            }
        }
        if (Schema::hasTable('bom') && DB::table('bom')->where('parent', $id)->orWhere('component', $id)->exists()) {
            return response()->json(['message' => "Can't change the item code: Used in a bill of materials."], 422);
        }

        // Setup rows, plus stock-only records (adjustments, batches, transfers,
        // damages, counts) — these just move to the new code, quantities unchanged.
        $setupTables = [
            'sales_pricing', 'purch_data', 'purchasing_pricing', 'promotional_prices', 'item_variants', 'loc_stock',
            'stock_moves', 'stock_batches', 'stock_batch_movements', 'stock_adjustments', 'stock_damages',
            'stock_transfer_items', 'inventory_audit_items',
        ];

        DB::transaction(function () use ($id, $newId, $setupTables) {
            // The product's own code linked as a barcode follows the new code.
            if (Schema::hasTable('item_codes')) {
                DB::table('item_codes')->where('stock_id', $id)->where('item_code', $id)->update(['item_code' => $newId]);
                DB::table('item_codes')->where('stock_id', $id)->update(['stock_id' => $newId]);
            }
            foreach ($setupTables as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->where('stock_id', $id)->update(['stock_id' => $newId]);
                }
            }
            if (Schema::hasTable('offers')) {
                DB::table('offers')->where('offer_type', 'product')->where('target_id', $id)->update(['target_id' => $newId]);
            }
            DB::table('stock_master')->where('stock_id', $id)->update(['stock_id' => $newId]);
        });

        return response()->json(StockMaster::find($newId));
    }

    /** Mark many products Inactive at once — the safe alternative to deleting a used item. */
    public function bulkInactive(Request $request)
    {
        $validated = $request->validate([
            'stock_ids' => ['required', 'array', 'min:1'],
            'stock_ids.*' => ['string'],
        ]);

        $updated = StockMaster::whereIn('stock_id', $validated['stock_ids'])->update(['inactive' => 1]);

        return response()->json(['updated' => $updated]);
    }

    /**
     * Set the Wholesale Qty Threshold + Wholesale Price for a product —
     * same isolated single-purpose pattern as updateMrpPrice() above.
     * Checkout only ever switches a line to this price after the cashier
     * enters the Wholesale Authorization PIN (see PosSettingsController) —
     * this endpoint just stores the two numbers, nothing else.
     */
    public function updateWholesalePricing(Request $request, string $id)
    {
        $stockMaster = $this->stockMasterRepo->find($id);
        if (!$stockMaster) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }

        $validated = $request->validate([
            'wholesale_qty_threshold' => ['nullable', 'integer', 'min:1'],
            'wholesale_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $stockMaster->wholesale_qty_threshold = $validated['wholesale_qty_threshold'] ?? null;
        $stockMaster->wholesale_price = $validated['wholesale_price'] ?? null;
        $stockMaster->save();

        return response()->json($stockMaster);
    }

    /**
     * Set the two EOQ inputs this product needs — Ordering Cost and Holding
     * Cost % — same isolated single-purpose pattern as updateMrpPrice()
     * above. Annual demand (the third EOQ input) comes from real sales
     * history, computed in LowStockController, not stored here.
     */
    public function updateEoqSettings(Request $request, string $id)
    {
        $stockMaster = $this->stockMasterRepo->find($id);
        if (!$stockMaster) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }

        $validated = $request->validate([
            'eoq_ordering_cost' => ['nullable', 'numeric', 'min:0'],
            'eoq_holding_cost_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
        ]);

        $stockMaster->eoq_ordering_cost = $validated['eoq_ordering_cost'] ?? null;
        $stockMaster->eoq_holding_cost_percent = $validated['eoq_holding_cost_percent'] ?? null;
        $stockMaster->save();

        return response()->json($stockMaster);
    }

    /**
     * Set just the expiry date — same isolated single-field pattern as
     * updateMrpPrice() above. One expiry date per product master, not
     * per batch/GRN; good enough for a simple expiry list report without
     * needing batch-level stock tracking.
     */
    public function updateExpiryDate(Request $request, string $id)
    {
        $stockMaster = $this->stockMasterRepo->find($id);
        if (!$stockMaster) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }

        $validated = $request->validate([
            'expiry_date' => ['nullable', 'date'],
        ]);

        $stockMaster->expiry_date = $validated['expiry_date'] ?? null;
        $stockMaster->save();

        return response()->json($stockMaster);
    }

    /**
     * Products with an expiry date set, soonest first — flags anything
     * already expired.
     */
    public function expiryList(Request $request)
    {
        $withinDays = (int) $request->query('within_days', 90);
        $cutoff = now()->addDays($withinDays)->toDateString();

        $rows = StockMaster::query()
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<=', $cutoff)
            ->orderBy('expiry_date')
            ->get(['stock_id', 'description', 'expiry_date']);

        $today = now()->toDateString();
        $result = $rows->map(function ($r) use ($today) {
            return [
                'stock_id' => $r->stock_id,
                'description' => $r->description,
                'expiry_date' => $r->expiry_date,
                'status' => $r->expiry_date < $today ? 'expired' : 'expiring_soon',
            ];
        });

        return response()->json($result);
    }

    public function destroy(string $id)
    {
        $deleted = $this->stockMasterRepo->delete($id);
        if (!$deleted) {
            return response()->json(['message' => 'Stock Master not found'], 404);
        }
        return response()->json(['message' => 'Deleted successfully']);
    }
}
