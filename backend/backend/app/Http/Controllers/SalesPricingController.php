<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalesPricingRequest;
use App\Models\ItemCode;
use App\Models\SalesPricing;
use App\Models\StockMaster;
use App\Repositories\All\SalesPricing\SalesPricingInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SalesPricingController extends Controller
{
    private SalesPricingInterface $salesPricingRepo;

    public function __construct(SalesPricingInterface $salesPricingRepo)
    {
        $this->salesPricingRepo = $salesPricingRepo;
    }
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $stockId = $request->query('stock_id');
        if ($stockId) {
            return response()->json(
                $this->salesPricingRepo->allWithRelationsByStockId($stockId),
                200
            );
        }

        return response()->json(
            $this->salesPricingRepo->allWithRelations(),
            200
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(SalesPricingRequest $request)
    {
        $validated = $request->validated();

        if ($this->duplicateExists($validated)) {
            return response()->json([
                'message' => 'A sales pricing with this currency and sales type already exists for this item.',
            ], 422);
        }

        $salesPricing = $this->salesPricingRepo->create($validated);
        return response()->json($salesPricing, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $salesPricing = $this->salesPricingRepo->findWithRelations($id);

        if (!$salesPricing) {
            return response()->json(['message' => 'Record not found'], 404);
        }

        return response()->json($salesPricing, 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SalesPricingRequest $request, string $id)
    {
        $validated = $request->validated();

        if ($this->duplicateExists($validated, $id)) {
            return response()->json([
                'message' => 'A sales pricing with this currency and sales type already exists for this item.',
            ], 422);
        }

        $updated = $this->salesPricingRepo->update($id, $validated);

        if (!$updated) {
            return response()->json(['message' => 'Record not found'], 404);
        }

        return response()->json(['message' => 'Updated successfully'], 200);
    }

    /**
     * Bulk price update — same upsert-by-(stock_id, currency, sales_type)
     * rule as store()/update() above, just applied to many rows from a
     * spreadsheet in one request instead of one product at a time. Each
     * row goes through the same validation and duplicate check; a bad row
     * is skipped and reported back, it never aborts the whole batch.
     *
     * A row may also carry optional product-level columns — mrp_price,
     * expiry_date, category_id, subcategory_id, brand_id, barcode — which
     * are plain classification/master-data fields, never the GL account
     * fields on stock_master, so this still can't touch accounting.
     */
    public function bulkUpsert(Request $request)
    {
        $rows = $request->input('rows', []);
        if (!is_array($rows) || $rows === []) {
            return response()->json(['message' => 'No rows provided.'], 422);
        }

        $updated = 0;
        $created = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            $validator = validator($row, (new SalesPricingRequest())->rules());
            if ($validator->fails()) {
                $errors[] = ['row' => $index + 1, 'stock_id' => $row['stock_id'] ?? null, 'message' => $validator->errors()->first()];
                continue;
            }
            $validated = $validator->validated();

            $existing = SalesPricing::query()
                ->where('stock_id', $validated['stock_id'])
                ->where('currency_id', $validated['currency_id'])
                ->where('sales_type_id', $validated['sales_type_id'])
                ->first();

            if ($existing) {
                $this->salesPricingRepo->update($existing->id, $validated);
                $updated++;
            } else {
                $this->salesPricingRepo->create($validated);
                $created++;
            }

            $this->applyOptionalProductFields($row, $validated['stock_id']);
        }

        return response()->json([
            'updated' => $updated,
            'created' => $created,
            'errors' => $errors,
        ]);
    }

    /**
     * Best-effort, isolated from the pricing upsert above — a bad optional
     * field on a row never blocks the price update it came with.
     */
    private function applyOptionalProductFields(array $row, string $stockId): void
    {
        try {
            $productFields = array_intersect_key($row, array_flip(['description', 'mrp_price', 'expiry_date', 'purchase_cost']));

            $validator = Validator::make($productFields, [
                'description' => ['nullable', 'string', 'max:200'],
                'mrp_price' => ['nullable', 'numeric', 'min:0'],
                'expiry_date' => ['nullable', 'date'],
                'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            ]);

            $updates = $validator->fails() ? [] : $validator->validated();

            // Category/subcategory/brand come in as human-readable names
            // (what the spreadsheet actually shows), not raw ids — resolve
            // each name to its id here. An unrecognized name is simply left
            // unchanged rather than failing the whole row.
            $categoryName = trim((string) ($row['category'] ?? ''));
            if ($categoryName !== '') {
                $categoryId = DB::table('item_category')->whereRaw('LOWER(description) = ?', [mb_strtolower($categoryName)])->value('category_id');
                if ($categoryId !== null) {
                    $updates['category_id'] = $categoryId;
                }
            }

            $subcategoryName = trim((string) ($row['subcategory'] ?? ''));
            if ($subcategoryName !== '') {
                $subcategoryId = DB::table('subcategories')->whereRaw('LOWER(name) = ?', [mb_strtolower($subcategoryName)])->value('id');
                if ($subcategoryId !== null) {
                    $updates['subcategory_id'] = $subcategoryId;
                }
            }

            $brandName = trim((string) ($row['brand'] ?? ''));
            if ($brandName !== '') {
                $brandId = DB::table('brands')->whereRaw('LOWER(name) = ?', [mb_strtolower($brandName)])->value('id');
                if ($brandId !== null) {
                    $updates['brand_id'] = $brandId;
                }
            }

            if ($updates !== []) {
                StockMaster::where('stock_id', $stockId)->update($updates);
            }

            $barcode = trim((string) ($row['barcode'] ?? ''));
            if ($barcode !== '' && !ItemCode::where('item_code', $barcode)->exists()) {
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

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $deleted = $this->salesPricingRepo->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Record not found'], 404);
        }

        return response()->json(['message' => 'Deleted successfully'], 200);
    }

    private function duplicateExists(array $validated, ?string $excludeId = null): bool
    {
        $query = SalesPricing::query()
            ->where('stock_id', $validated['stock_id'])
            ->where('currency_id', $validated['currency_id'])
            ->where('sales_type_id', $validated['sales_type_id']);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }
}
