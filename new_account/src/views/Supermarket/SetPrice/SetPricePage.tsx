import { useEffect, useMemo, useRef, useState } from "react";
import { toSinhalaSearch } from "../../../utils/singlishSearch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Stack, TextField, Autocomplete, Button, Typography, Divider,
  InputAdornment, Table, TableHead, TableRow, TableCell, TableBody, Chip, Tabs, Tab,
} from "@mui/material";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getStockList } from "../../../api/Inventory/StockListApi";
import { createItemCode } from "../../../api/ItemCodes/ItemCodesApi";
import { updateMrpPrice, updateExpiryDate, updateWholesalePricing, updateEoqSettings } from "../../../api/Item/ItemApi";
import { useNavigate } from "react-router-dom";
import { getSalesPricingByStockId, createSalesPricing, updateSalesPricing } from "../../../api/SalesPricing/SalesPricingApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";
import StockBatchesPanel from "../../../components/StockBatchesPanel";

const LKR_CURRENCY_ID = 8; // only currency configured in this system
const RETAIL_SALES_TYPE_ID = 3; // default price list for supermarket walk-in sales

/**
 * Set the Selling Price for products already purchased and sitting in
 * inventory — separate from Purchase Cost. Uses the ERP's already-existing
 * Sales Pricing feature (sales_pricing table) — genuine, real pricing data
 * the same way the full Item Maintenance → Pricing screen would, just a
 * short, barcode-friendly front end over it. Pure master-data — no GL
 * entries, no stock movement, nothing accounting-related happens here.
 */
export default function SetPricePage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const navigate = useNavigate();


  // ---- Individual product state ----
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [margin, setMargin] = useState("20");
  const [sellingPrice, setSellingPrice] = useState("");
  const [lastEdited, setLastEdited] = useState<"margin" | "price">("margin");
  const [newBarcode, setNewBarcode] = useState("");
  const [mrpPrice, setMrpPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [activeTab, setActiveTab] = useState<"retail" | "wholesale" | "eoq" | "batches">("retail");
  const [wholesaleQty, setWholesaleQty] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [eoqOrderingCost, setEoqOrderingCost] = useState("");
  const [eoqHoldingCostPercent, setEoqHoldingCostPercent] = useState("");

  const { data: typedResults } = useQuery({
    queryKey: ["stock-search", search],
    queryFn: () => getStockList({ search: search || undefined }),
    enabled: search.length > 0,
  });

  // Singlish search, same as POS Checkout: "parippu" also searches "පරිප්පු".
  const sinhalaSearch = useMemo(() => toSinhalaSearch(search), [search]);

  const { data: sinhalaResults } = useQuery({
    queryKey: ["stock-search", sinhalaSearch],
    queryFn: () => getStockList({ search: sinhalaSearch }),
    enabled: sinhalaSearch.length > 0,
  });

  const results = useMemo(() => {
    const seen = new Set<string>();
    return [...(typedResults ?? []), ...(sinhalaSearch ? sinhalaResults ?? [] : [])].filter((p: any) => {
      const id = String(p.stock_id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [typedResults, sinhalaResults, sinhalaSearch]);

  const { data: existingPricing, isFetched: pricingFetched } = useQuery({
    queryKey: ["sales-pricing", product?.stock_id],
    queryFn: () => getSalesPricingByStockId(product.stock_id),
    enabled: !!product,
  });
  // Product whose saved price has already been loaded into the fields — so
  // later refetches (e.g. after Save) don't overwrite what the user is typing.
  const pricingLoadedFor = useRef<string | null>(null);

  const currentPricing = (existingPricing ?? []).find(
    (p: any) => p.sales_type_id === RETAIL_SALES_TYPE_ID && p.currency_id === LKR_CURRENCY_ID
  );

  const cost = Number(product?.purchase_cost) || 0;
  // Weighed items (kg, g, ...) vs counted items (pcs, unit, ...) — labels
  // the Wholesale Threshold field with whichever this product actually uses,
  // instead of assuming it's always a plain piece count.
  const productUnitName: string | null = product?.unit_name ?? null;

  // Selling price and margin stay in sync with each other — editing either
  // one recalculates the other, whichever the user touched last wins.
  useEffect(() => {
    if (!product) return;
    if (lastEdited === "margin") {
      const computed = cost * (1 + (Number(margin) || 0) / 100);
      setSellingPrice(computed ? computed.toFixed(2) : "");
    }
  }, [margin, cost, product, lastEdited]);

  useEffect(() => {
    if (!product) return;
    if (lastEdited === "price" && cost > 0 && sellingPrice !== "") {
      const computedMargin = ((Number(sellingPrice) || 0) - cost) / cost * 100;
      setMargin(computedMargin.toFixed(1));
    }
  }, [sellingPrice, cost, product, lastEdited]);

  // On opening a product, show its saved selling price and the real margin
  // (saved price vs purchase cost) instead of a fixed 20% default. Margin is
  // left blank when there's no purchase cost to calculate it from.
  useEffect(() => {
    if (!product || !pricingFetched) return;
    const stockId = String(product.stock_id);
    if (pricingLoadedFor.current === stockId) return;
    pricingLoadedFor.current = stockId;
    if (currentPricing) {
      const saved = Number(currentPricing.price) || 0;
      setLastEdited("price");
      setSellingPrice(saved ? String(saved) : "");
      setMargin(cost > 0 && saved ? (((saved - cost) / cost) * 100).toFixed(1) : "");
    } else {
      // No saved price yet: suggest one from the purchase cost, as before.
      setLastEdited("margin");
      setMargin("20");
    }
  }, [product, pricingFetched, currentPricing, cost]);

  const selectProduct = (p: any) => {
    pricingLoadedFor.current = null;
    setProduct(p);
    setSearch("");
    setMargin("");
    setSellingPrice("");
    setLastEdited("price");
    setNewBarcode("");
    setMrpPrice(p.mrp_price != null ? String(p.mrp_price) : "");
    setExpiryDate(p.expiry_date ? String(p.expiry_date).slice(0, 10) : "");
    setWholesaleQty(p.wholesale_qty_threshold != null ? String(p.wholesale_qty_threshold) : "");
    setWholesalePrice(p.wholesale_price != null ? String(p.wholesale_price) : "");
    setEoqOrderingCost(p.eoq_ordering_cost != null ? String(p.eoq_ordering_cost) : "");
    setEoqHoldingCostPercent(p.eoq_holding_cost_percent != null ? String(p.eoq_holding_cost_percent) : "");
  };

  const saveMrpMutation = useMutation({
    mutationFn: () => updateMrpPrice(product.stock_id, mrpPrice ? Number(mrpPrice) : null),
    onSuccess: () => {
      notify.success("MRP price saved");
      queryClient.invalidateQueries({ queryKey: ["stock-search"] });
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      // the current packets' batches carry the new MRP too
      queryClient.invalidateQueries({ queryKey: ["stock-batches"] });
      queryClient.invalidateQueries({ queryKey: ["pos-multi-price"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save MRP price"),
  });

  const saveExpiryMutation = useMutation({
    mutationFn: () => updateExpiryDate(product.stock_id, expiryDate || null),
    onSuccess: () => {
      notify.success("Expiry date saved");
      queryClient.invalidateQueries({ queryKey: ["stock-search"] });
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save expiry date"),
  });

  const saveWholesaleMutation = useMutation({
    mutationFn: () => updateWholesalePricing(
      product.stock_id,
      wholesaleQty ? Number(wholesaleQty) : null,
      wholesalePrice ? Number(wholesalePrice) : null
    ),
    onSuccess: () => {
      notify.success("Wholesale pricing saved");
      queryClient.invalidateQueries({ queryKey: ["stock-search"] });
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save wholesale pricing"),
  });

  const saveEoqMutation = useMutation({
    mutationFn: () => updateEoqSettings(
      product.stock_id,
      eoqOrderingCost ? Number(eoqOrderingCost) : null,
      eoqHoldingCostPercent ? Number(eoqHoldingCostPercent) : null
    ),
    onSuccess: () => {
      notify.success("EOQ settings saved");
      queryClient.invalidateQueries({ queryKey: ["stock-search"] });
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save EOQ settings"),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        stock_id: product.stock_id,
        currency_id: LKR_CURRENCY_ID,
        sales_type_id: RETAIL_SALES_TYPE_ID,
        price: Number(sellingPrice) || 0,
      };
      return currentPricing
        ? updateSalesPricing(currentPricing.id, payload)
        : createSalesPricing(payload);
    },
    onSuccess: () => {
      notify.success("Selling price saved");
      queryClient.invalidateQueries({ queryKey: ["sales-pricing", product?.stock_id] });
      // the current packets' batches take the new price too
      queryClient.invalidateQueries({ queryKey: ["stock-batches"] });
      queryClient.invalidateQueries({ queryKey: ["pos-multi-price"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save selling price"),
  });

  // Links a real manufacturer barcode to the already-selected product — the
  // same Foreign Item Code mechanism used everywhere else in this ERP.
  // Pure identification data (barcode number -> stock_id), no GL/tax/cost
  // fields involved, so it can't affect accounting.
  const linkBarcodeMutation = useMutation({
    mutationFn: () => createItemCode({
      item_code: newBarcode.trim(),
      stock_id: product.stock_id,
      description: product.description,
      category_id: product.category_id,
      quantity: 1,
      is_foreign: true,
    }),
    onSuccess: () => {
      notify.success("Barcode linked to this product");
      queryClient.invalidateQueries({ queryKey: ["stock-search"] });
      setProduct((prev: any) => (prev ? { ...prev, barcode: newBarcode.trim() } : prev));
      setNewBarcode("");
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to link barcode — it may already be linked to another product"),
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <PageTitle title="Set Price" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Set Price" }]} />
          <Typography variant="caption" color="text.secondary">
            Set the selling price for products already purchased and in stock — separate from purchase cost. POS Checkout charges this price.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<PriceChangeIcon />} onClick={() => navigate("/supermarket/mrp-setup")}>
          MRP Price Setup
        </Button>
      </Box>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Autocomplete
              options={results ?? []}
              getOptionLabel={(p: any) => p.description ?? p.stock_id ?? ""}
              inputValue={search}
              onInputChange={(_, v) => setSearch(v)}
              onChange={(_, v) => v && selectProduct(v)}
              filterOptions={(x) => x}
              renderOption={(props, option: any) => (
                <li {...props} key={option.stock_id}>
                  <Stack>
                    <Typography variant="body2">{option.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.stock_id} {option.barcode ? `· Barcode: ${option.barcode}` : ""}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Find Product"
                  placeholder="Search or scan barcode — type name, stock ID, or barcode"
                  size="small"
                />
              )}
            />

            {product && (
              <>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>{product.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {product.stock_id} {product.barcode ? `· Barcode: ${product.barcode}` : "· No barcode linked"}
                    </Typography>
                  </Box>
                  <Chip label={`Stock on hand: ${product.quantity}`} />
                </Stack>

                {!product.barcode && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                    <TextField
                      label="Link Barcode" size="small" fullWidth
                      placeholder="Scan the packet's barcode, or type it"
                      value={newBarcode} onChange={(e) => setNewBarcode(e.target.value)}
                      helperText="This product has no barcode on file yet — link the real one printed on it"
                    />
                    <Button
                      variant="outlined" sx={{ whiteSpace: "nowrap" }}
                      disabled={!newBarcode.trim() || linkBarcodeMutation.isPending}
                      onClick={() => linkBarcodeMutation.mutate()}
                    >
                      {linkBarcodeMutation.isPending ? "Linking..." : "Link Barcode"}
                    </Button>
                  </Stack>
                )}

                <Button
                  variant="text" size="small" sx={{ alignSelf: "flex-start" }}
                  onClick={() => navigate(`/itemsandinventory/maintenance/foreign-item-codes?stock_id=${encodeURIComponent(product.stock_id)}`)}
                >
                  Manage all barcodes for this product
                </Button>

                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                  <Tab value="retail" label="Retail Pricing" />
                  <Tab value="wholesale" label="Wholesale Pricing" />
                  <Tab value="eoq" label="EOQ Setup" />
                  <Tab value="batches" label="Batches (Prices)" />
                </Tabs>

                {activeTab === "batches" && (
                  <StockBatchesPanel stockId={String(product.stock_id)} formatCurrency={(v) => formatCurrency(v)} />
                )}

                {activeTab === "retail" && (
                  <>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label="Purchase Cost" size="small" sx={{ flex: 1 }}
                        value={formatCurrency(cost)} disabled
                      />
                      <TextField
                        label="Profit Margin" type="number" size="small" sx={{ flex: 1 }}
                        value={margin}
                        onChange={(e) => { setLastEdited("margin"); setMargin(e.target.value); }}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                      />
                      <TextField
                        label="Selling Price" type="number" size="small" sx={{ flex: 1 }}
                        value={sellingPrice}
                        onChange={(e) => { setLastEdited("price"); setSellingPrice(e.target.value); }}
                      />
                      <TextField
                        label="MRP Price" type="number" size="small" sx={{ flex: 1 }}
                        value={mrpPrice}
                        onChange={(e) => setMrpPrice(e.target.value)}
                        helperText="Shown to the cashier during checkout"
                      />
                      <TextField
                        label="Expiry Date" type="date" size="small" sx={{ flex: 1 }}
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        helperText="Optional — feeds the Expiry List report"
                      />
                    </Stack>

                    {currentPricing && (
                      <Typography variant="caption" color="text.secondary">
                        Current selling price on file: {formatCurrency(currentPricing.price)}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={2}>
                      <Button
                        variant="contained" size="large" startIcon={<PriceChangeIcon />}
                        disabled={!sellingPrice || Number(sellingPrice) <= 0 || saveMutation.isPending}
                        onClick={() => saveMutation.mutate()}
                      >
                        {saveMutation.isPending ? "Saving..." : "Save Selling Price"}
                      </Button>
                      <Button
                        variant="outlined" size="large"
                        disabled={saveMrpMutation.isPending}
                        onClick={() => saveMrpMutation.mutate()}
                      >
                        {saveMrpMutation.isPending ? "Saving..." : "Save MRP Price"}
                      </Button>
                      <Button
                        variant="outlined" size="large"
                        disabled={saveExpiryMutation.isPending}
                        onClick={() => saveExpiryMutation.mutate()}
                      >
                        {saveExpiryMutation.isPending ? "Saving..." : "Save Expiry Date"}
                      </Button>
                    </Stack>

                    {/* Every batch of this product (old + new deliveries), editable here too. */}
                    <Divider />
                    <Typography variant="subtitle2">Batches in stock</Typography>
                    <StockBatchesPanel stockId={String(product.stock_id)} formatCurrency={(v) => formatCurrency(v)} />
                  </>
                )}

                {activeTab === "wholesale" && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      Once a cart line's {productUnitName ? productUnitName.toLowerCase() : "quantity"} passes the
                      threshold below, the cashier can apply this Wholesale Price at POS Checkout — only after
                      entering the Wholesale Authorization PIN (set under Supermarket → POS Settings).
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label={`Wholesale Threshold${productUnitName ? ` (${productUnitName})` : ""}`}
                        type="number" size="small" sx={{ flex: 1 }}
                        value={wholesaleQty}
                        onChange={(e) => setWholesaleQty(e.target.value)}
                        helperText={
                          productUnitName
                            ? `e.g. 10 ${productUnitName} — buying more than this unlocks the wholesale price`
                            : "e.g. 10 — buying more than this unlocks the wholesale price"
                        }
                      />
                      <TextField
                        label={`Wholesale Price${productUnitName ? ` (per ${productUnitName})` : ""}`}
                        type="number" size="small" sx={{ flex: 1 }}
                        value={wholesalePrice}
                        onChange={(e) => setWholesalePrice(e.target.value)}
                        helperText="Price once the threshold is passed"
                      />
                    </Stack>
                    <Button
                      variant="contained" size="large" startIcon={<PriceChangeIcon />}
                      disabled={saveWholesaleMutation.isPending}
                      onClick={() => saveWholesaleMutation.mutate()}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      {saveWholesaleMutation.isPending ? "Saving..." : "Save Wholesale Pricing"}
                    </Button>
                  </>
                )}

                {activeTab === "eoq" && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      EOQ (Economic Order Quantity) is the ideal amount to reorder at once — it balances ordering
                      cost against holding cost, using this product's real sales history as demand. Set the two
                      inputs below, and the suggested reorder quantity shows up automatically on Low Stock Alerts.
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label="Ordering Cost" type="number" size="small" sx={{ flex: 1 }}
                        value={eoqOrderingCost}
                        onChange={(e) => setEoqOrderingCost(e.target.value)}
                        helperText="Cost to place one purchase order for this item (delivery, admin, etc.)"
                      />
                      <TextField
                        label="Holding Cost" type="number" size="small" sx={{ flex: 1 }}
                        value={eoqHoldingCostPercent}
                        onChange={(e) => setEoqHoldingCostPercent(e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        helperText="Yearly cost to store one unit, as a % of its Purchase Cost"
                      />
                    </Stack>
                    <Button
                      variant="contained" size="large" startIcon={<PriceChangeIcon />}
                      disabled={saveEoqMutation.isPending}
                      onClick={() => saveEoqMutation.mutate()}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      {saveEoqMutation.isPending ? "Saving..." : "Save EOQ Settings"}
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </FormPageLayout>
  );
}
