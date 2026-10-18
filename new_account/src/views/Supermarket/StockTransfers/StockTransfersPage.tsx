import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete,
  FormControl, InputLabel, Select, MenuItem, Chip, Checkbox, FormControlLabel, InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getStockTransfers, createStockTransfer, dispatchStockTransfer, receiveStockTransfer } from "../../../api/Pos/posOpsApi";
import { getStockList } from "../../../api/Inventory/StockListApi";
import { getLocStocks } from "../../../api/LocStock/LocStockApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { getItemCategories } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getBrands } from "../../../api/Brands/BrandsApi";
import { getSubcategories } from "../../../api/Subcategories/SubcategoriesApi";
import { toSinhalaSearch } from "../../../utils/singlishSearch";
import { notify } from "../../../services/notificationService";

const statusColor: Record<string, "default" | "warning" | "info" | "success" | "error"> = {
  pending: "warning", dispatched: "info", received: "success", cancelled: "error",
};

export default function StockTransfersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  // Ticked products → quantity typed for each (kept as text while editing).
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<any>(null);
  const [subcategory, setSubcategory] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [inStockOnly, setInStockOnly] = useState(true);

  const { data: transfers, isLoading } = useQuery({ queryKey: ["stock-transfers"], queryFn: getStockTransfers });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });
  const { data: products } = useQuery({ queryKey: ["stock-list-all"], queryFn: () => getStockList(), enabled: open });
  const { data: locStocks } = useQuery({ queryKey: ["loc-stocks"], queryFn: getLocStocks, enabled: open });
  const { data: categories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories(), enabled: open });
  const { data: subcategories } = useQuery({ queryKey: ["subcategories"], queryFn: () => getSubcategories(), enabled: open });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => getBrands(), enabled: open });

  // Stock on hand at the From location, per product.
  const availableAtFrom = useMemo(() => {
    const map = new Map<string, number>();
    if (!fromLoc) return map;
    for (const row of locStocks ?? []) {
      if (String(row.loc_code) === String(fromLoc)) map.set(String(row.stock_id), Number(row.quantity) || 0);
    }
    return map;
  }, [locStocks, fromLoc]);
  const available = (stockId: string) => availableAtFrom.get(String(stockId)) ?? 0;

  const sinhalaSearch = useMemo(() => toSinhalaSearch(search), [search]);
  const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);

  const visibleProducts = useMemo(() => (products ?? []).filter((p: any) => {
    const term = search.trim().toLowerCase();
    if (term) {
      const name = String(p.description ?? "").toLowerCase();
      const matches = name.includes(term)
        || String(p.stock_id ?? "").toLowerCase().includes(term)
        || String(p.barcode ?? "").includes(search.trim())
        || (!!sinhalaSearch && name.includes(sinhalaSearch));
      if (!matches) return false;
    }
    if (category && !sameId(p.category_id, category.category_id)) return false;
    if (subcategory && !sameId(p.subcategory_id, subcategory.id)) return false;
    if (brand && !sameId(p.brand_id, brand.id)) return false;
    if (inStockOnly && fromLoc && available(p.stock_id) <= 0) return false;
    return true;
  }), [products, search, sinhalaSearch, category, subcategory, brand, inStockOnly, fromLoc, availableAtFrom]);

  const qtyError = (stockId: string, qtyText: string): string | null => {
    const qty = Number(qtyText);
    if (!qtyText || isNaN(qty) || qty <= 0) return "Enter a qty";
    if (qty > available(stockId)) return `Only ${available(stockId)} in stock`;
    return null;
  };
  const selectedLines = Array.from(selected.entries());
  const hasErrors = selectedLines.some(([id, q]) => qtyError(id, q) !== null);
  const sameLocation = !!fromLoc && fromLoc === toLoc;

  const toggleProduct = (stockId: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(stockId)) next.delete(stockId); else next.set(stockId, "1");
      return next;
    });
  };
  const setLineQty = (stockId: string, qtyText: string) => {
    setSelected((prev) => new Map(prev).set(stockId, qtyText));
  };
  const visibleSelectedCount = visibleProducts.filter((p: any) => selected.has(String(p.stock_id))).length;
  const allVisibleSelected = visibleProducts.length > 0 && visibleSelectedCount === visibleProducts.length;
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allVisibleSelected) visibleProducts.forEach((p: any) => next.delete(String(p.stock_id)));
      else visibleProducts.forEach((p: any) => { if (!next.has(String(p.stock_id))) next.set(String(p.stock_id), "1"); });
      return next;
    });
  };

  const resetForm = () => {
    setFromLoc(""); setToLoc(""); setSelected(new Map()); setSearch("");
    setCategory(null); setSubcategory(null); setBrand(null); setInStockOnly(true);
  };
  const closeDialog = () => { setOpen(false); resetForm(); };

  const createMutation = useMutation({
    mutationFn: createStockTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      notify.success("Stock transfer created");
      closeDialog();
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to create stock transfer"),
  });

  const dispatchMutation = useMutation({
    mutationFn: dispatchStockTransfer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
  });

  const receiveMutation = useMutation({
    mutationFn: receiveStockTransfer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
  });

  const handleSubmit = () => {
    if (!fromLoc || !toLoc || sameLocation || selectedLines.length === 0 || hasErrors) return;
    createMutation.mutate({
      from_loc_code: fromLoc,
      to_loc_code: toLoc,
      items: selectedLines.map(([stockId, q]) => ({ stock_id: stockId, quantity: Number(q) })),
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Stock Transfers" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Stock Transfers" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New Transfer</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Ref</TableCell><TableCell>From</TableCell><TableCell>To</TableCell>
                <TableCell>Items</TableCell><TableCell align="center">Status</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(transfers ?? []).map((t: any) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.transfer_ref}</TableCell>
                  <TableCell>{t.from_loc_code}</TableCell>
                  <TableCell>{t.to_loc_code}</TableCell>
                  <TableCell>{(t.items ?? []).map((i: any) => `${i.stock?.description ?? i.stock_id} x${i.quantity}`).join(", ")}</TableCell>
                  <TableCell align="center"><Chip label={t.status} size="small" color={statusColor[t.status]} /></TableCell>
                  <TableCell align="center">
                    {t.status === "pending" && (
                      <Button size="small" startIcon={<LocalShippingIcon />} onClick={() => dispatchMutation.mutate(t.id)}>Dispatch</Button>
                    )}
                    {t.status === "dispatched" && (
                      <Button size="small" startIcon={<CheckCircleIcon />} onClick={() => receiveMutation.mutate(t.id)}>Receive</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!transfers || transfers.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No transfers yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>New Stock Transfer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>From Location</InputLabel>
                <Select value={fromLoc} label="From Location" onChange={(e) => setFromLoc(e.target.value)}>
                  {(locations ?? []).map((loc: any) => <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" error={sameLocation}>
                <InputLabel>To Location</InputLabel>
                <Select value={toLoc} label="To Location" onChange={(e) => setToLoc(e.target.value)}>
                  {(locations ?? []).map((loc: any) => <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            {sameLocation && (
              <Typography variant="caption" color="error">From and To location must be different.</Typography>
            )}

            {!fromLoc ? (
              <Typography variant="body2" color="text.secondary">Choose the From Location to see its products.</Typography>
            ) : (
              <>
                <TextField
                  size="small" fullWidth
                  placeholder="Search by name, stock ID or barcode"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                  <Autocomplete
                    sx={{ flex: 1 }} size="small"
                    options={categories ?? []}
                    getOptionLabel={(c: any) => c.description ?? ""}
                    value={category} onChange={(_, v) => setCategory(v)}
                    renderInput={(p) => <TextField {...p} label="Category" size="small" />}
                  />
                  <Autocomplete
                    sx={{ flex: 1 }} size="small"
                    options={subcategories ?? []}
                    getOptionLabel={(sc: any) => sc.name ?? ""}
                    value={subcategory} onChange={(_, v) => setSubcategory(v)}
                    renderInput={(p) => <TextField {...p} label="Subcategory" size="small" />}
                  />
                  <Autocomplete
                    sx={{ flex: 1 }} size="small"
                    options={brands ?? []}
                    getOptionLabel={(b: any) => b.name ?? ""}
                    value={brand} onChange={(_, v) => setBrand(v)}
                    renderInput={(p) => <TextField {...p} label="Brand" size="small" />}
                  />
                </Stack>
                <FormControlLabel
                  control={<Checkbox size="small" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />}
                  label={<Typography variant="body2">Show only items in stock at the From location</Typography>}
                />

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "45vh" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={allVisibleSelected}
                            indeterminate={visibleSelectedCount > 0 && !allVisibleSelected}
                            onChange={toggleAllVisible}
                          />
                        </TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Stock ID</TableCell>
                        <TableCell align="right">In Stock</TableCell>
                        <TableCell align="right" sx={{ width: 150 }}>Qty to Transfer</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visibleProducts.map((p: any) => {
                        const id = String(p.stock_id);
                        const isSelected = selected.has(id);
                        const qtyText = selected.get(id) ?? "";
                        const error = isSelected ? qtyError(id, qtyText) : null;
                        return (
                          <TableRow key={id} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={isSelected} onChange={() => toggleProduct(id)} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{p.description}</Typography>
                              {p.barcode && <Typography variant="caption" color="text.secondary">Barcode: {p.barcode}</Typography>}
                            </TableCell>
                            <TableCell>{id}</TableCell>
                            <TableCell align="right">{available(id)}</TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small" type="number" disabled={!isSelected}
                                value={qtyText} onChange={(e) => setLineQty(id, e.target.value)}
                                error={!!error} helperText={error ?? " "}
                                inputProps={{ min: 0, step: "any", style: { textAlign: "right" } }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {visibleProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">
                              {inStockOnly ? "No items in stock at this location match." : "No matching products."}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="body2" fontWeight={600}>{selectedLines.length} item(s) selected</Typography>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!fromLoc || !toLoc || sameLocation || selectedLines.length === 0 || hasErrors || createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? "Creating..." : `Create Transfer${selectedLines.length ? ` (${selectedLines.length})` : ""}`}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
