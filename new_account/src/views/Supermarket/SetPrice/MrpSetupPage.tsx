import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Stack, TextField, Typography, InputAdornment,
  Table, TableHead, TableRow, TableCell, TableBody, Checkbox, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, Autocomplete,
} from "@mui/material";
import { getItemCategories } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getBrands } from "../../../api/Brands/BrandsApi";
import { getSubcategories } from "../../../api/Subcategories/SubcategoriesApi";
import { toSinhalaSearch } from "../../../utils/singlishSearch";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getStockList } from "../../../api/Inventory/StockListApi";
import { updateMrpPrice } from "../../../api/Item/ItemApi";
import { getSalesPricing } from "../../../api/SalesPricing/SalesPricingApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";

export default function MrpSetupPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();

  const [bulkMarkup, setBulkMarkup] = useState("6");
  const [markupMode, setMarkupMode] = useState<"percent" | "amount">("percent");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkSearch, setBulkSearch] = useState("");
  const [category, setCategory] = useState<any>(null);
  const [subcategory, setSubcategory] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);

  const { data: categories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories() });
  const { data: subcategories } = useQuery({ queryKey: ["subcategories"], queryFn: () => getSubcategories() });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => getBrands() });

  const { data: allStock, isLoading: stockLoading } = useQuery({
    queryKey: ["stock-list-all-mrp"],
    queryFn: () => getStockList({ per_page: 9999 } as any),
  });

  const { data: allPricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["sales-pricing-all-mrp"],
    queryFn: getSalesPricing,
  });

  const isLoading = stockLoading || pricingLoading;

  // Build a map of stock_id -> selling price from sales_pricing (retail sales type)
  const sellingPriceMap = new Map<string, number>();
  if (Array.isArray(allPricing)) {
    for (const p of allPricing) {
      const sid = p.stock_id ?? p.item_code ?? p.stock_code;
      const price = Number(p.price ?? p.unit_price ?? p.selling_price ?? 0);
      if (sid && price > 0) sellingPriceMap.set(String(sid), price);
    }
  }

  const rawStock: any[] = Array.isArray(allStock) ? allStock : (allStock as any)?.data ?? [];

  // Merge selling price into each stock item
  const stockList = rawStock.map((s: any) => ({
    ...s,
    selling_price: sellingPriceMap.get(String(s.stock_id)) ?? 0,
  }));

  // Singlish search, same as POS Checkout: "parippu" also matches "පරිප්පු".
  const sinhalaSearch = useMemo(() => toSinhalaSearch(bulkSearch), [bulkSearch]);
  const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);

  const filteredStock = stockList.filter((s: any) => {
    const term = bulkSearch.trim().toLowerCase();
    if (term) {
      const name = String(s.description ?? "").toLowerCase();
      const id = String(s.stock_id ?? "").toLowerCase();
      const matches = name.includes(term) || id.includes(term) || (!!sinhalaSearch && name.includes(sinhalaSearch));
      if (!matches) return false;
    }
    if (category && !sameId(s.category_id, category.category_id)) return false;
    if (subcategory && !sameId(s.subcategory_id, subcategory.id)) return false;
    if (brand && !sameId(s.brand_id, brand.id)) return false;
    return true;
  });

  // Only ticked items that are currently visible get the MRP — so the button
  // count must match what Apply will actually update.
  const selectedVisibleCount = filteredStock.filter((s: any) => bulkSelected.has(s.stock_id)).length;

  const toggleSelect = (stockId: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      next.has(stockId) ? next.delete(stockId) : next.add(stockId);
      return next;
    });
  };

  const toggleAll = () => {
    if (filteredStock.length > 0 && selectedVisibleCount === filteredStock.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(filteredStock.map((s: any) => s.stock_id)));
    }
  };

  const applyBulkMrp = async () => {
    const markup = bulkMarkup === "" ? 6 : Number(bulkMarkup);
    const targets = filteredStock.filter((s: any) => bulkSelected.has(s.stock_id));
    if (!targets.length) return;
    setBulkProgress({ done: 0, total: targets.length });
    let done = 0;
    for (const item of targets) {
      const sellingPrice = Number(item.selling_price ?? 0);
      const newMrp = sellingPrice > 0
        ? markupMode === "percent"
          ? +(sellingPrice * (1 + markup / 100)).toFixed(2)
          : +(sellingPrice + markup).toFixed(2)
        : null;
      if (newMrp !== null) {
        try { await updateMrpPrice(item.stock_id, newMrp); } catch { /* skip failed */ }
      }
      done++;
      setBulkProgress({ done, total: targets.length });
    }
    setBulkProgress(null);
    setBulkSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["stock-list-all-mrp"] });
    queryClient.invalidateQueries({ queryKey: ["sales-pricing-all-mrp"] });
    queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    notify.success(`MRP updated for ${done} items`);
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="MRP Price Setup" />
        <Breadcrumb breadcrumbs={[
          { title: "Smart Supermarket", href: "/supermarket" },
          { title: "Set Price", href: "/supermarket/set-price" },
          { title: "MRP Price Setup" },
        ]} />
        <Typography variant="caption" color="text.secondary">
          Set MRP for multiple items at once using a % markup over selling price. MRP is always shown higher than selling price on the receipt.
        </Typography>
      </Box>

      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <FormControl size="small" sx={{ width: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={markupMode}
                  label="Type"
                  onChange={(e) => setMarkupMode(e.target.value as "percent" | "amount")}
                >
                  <MenuItem value="percent">Percentage (%)</MenuItem>
                  <MenuItem value="amount">Fixed Amount</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={markupMode === "percent" ? "Markup %" : "Markup Amount"}
                type="number" size="small" sx={{ width: 160 }}
                value={bulkMarkup}
                onChange={(e) => setBulkMarkup(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">{markupMode === "percent" ? "%" : "Rs"}</InputAdornment> }}
                helperText={markupMode === "percent" ? "MRP = Selling Price + this %" : "MRP = Selling Price + this amount"}
              />
            </Stack>
            <TextField
              label="Search items" size="small" sx={{ flex: 1 }}
              value={bulkSearch}
              onChange={(e) => setBulkSearch(e.target.value)}
              placeholder="Filter by name or stock ID"
            />
            <Button
              variant="contained"
              disabled={selectedVisibleCount === 0 || !!bulkProgress}
              onClick={applyBulkMrp}
              startIcon={<PriceChangeIcon />}
              sx={{ height: 40, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {bulkProgress
                ? `Updating ${bulkProgress.done}/${bulkProgress.total}...`
                : `Apply to ${selectedVisibleCount} item${selectedVisibleCount !== 1 ? "s" : ""}`}
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              sx={{ flex: 1 }}
              options={categories ?? []}
              getOptionLabel={(c: any) => c.description ?? ""}
              value={category}
              onChange={(_, v) => setCategory(v)}
              renderInput={(p) => <TextField {...p} label="Category" size="small" />}
            />
            <Autocomplete
              sx={{ flex: 1 }}
              options={subcategories ?? []}
              getOptionLabel={(sc: any) => sc.name ?? ""}
              value={subcategory}
              onChange={(_, v) => setSubcategory(v)}
              renderInput={(p) => <TextField {...p} label="Subcategory" size="small" />}
            />
            <Autocomplete
              sx={{ flex: 1 }}
              options={brands ?? []}
              getOptionLabel={(b: any) => b.name ?? ""}
              value={brand}
              onChange={(_, v) => setBrand(v)}
              renderInput={(p) => <TextField {...p} label="Brand" size="small" />}
            />
          </Stack>

          {bulkProgress && (
            <LinearProgress variant="determinate" value={(bulkProgress.done / bulkProgress.total) * 100} />
          )}

          {isLoading ? (
            <LinearProgress />
          ) : (
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflowY: "auto", maxHeight: "calc(100vh - 340px)" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={filteredStock.length > 0 && selectedVisibleCount === filteredStock.length}
                        indeterminate={selectedVisibleCount > 0 && selectedVisibleCount < filteredStock.length}
                        onChange={toggleAll}
                      />
                    </TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Selling Price</TableCell>
                    <TableCell align="right">Current MRP</TableCell>
                    <TableCell align="right">New MRP (+{bulkMarkup || (markupMode === "percent" ? 6 : 0)}{markupMode === "percent" ? "%" : " Rs"})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStock.map((item: any) => {
                    const sp = Number(item.selling_price ?? 0);
                    const mv = Number(bulkMarkup) || 0;
                    const newMrp = sp > 0
                      ? markupMode === "percent"
                        ? +(sp * (1 + mv / 100)).toFixed(2)
                        : +(sp + mv).toFixed(2)
                      : null;
                    return (
                      <TableRow
                        key={item.stock_id}
                        hover
                        selected={bulkSelected.has(item.stock_id)}
                        onClick={() => toggleSelect(item.stock_id)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={bulkSelected.has(item.stock_id)}
                            onChange={() => toggleSelect(item.stock_id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.stock_id}</Typography>
                        </TableCell>
                        <TableCell align="right">{sp > 0 ? formatCurrency(sp) : <Typography variant="caption" color="text.secondary">No price set</Typography>}</TableCell>
                        <TableCell align="right">
                          {item.mrp_price != null
                            ? formatCurrency(Number(item.mrp_price))
                            : <Typography variant="caption" color="text.secondary">Not set</Typography>}
                        </TableCell>
                        <TableCell align="right">{newMrp !== null ? formatCurrency(newMrp) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredStock.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2">No items found.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </Box>
    </FormPageLayout>
  );
}
