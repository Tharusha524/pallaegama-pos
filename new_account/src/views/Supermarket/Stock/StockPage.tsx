import { Fragment, useEffect, useMemo, useState } from "react";
import { toSinhalaSearch } from "../../../utils/singlishSearch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Stack, TextField, Autocomplete, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, Typography, Chip, InputAdornment, IconButton,
  Collapse, Button, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Grid, Tabs, Tab, Tooltip, Checkbox, LinearProgress,
} from "@mui/material";
import * as XLSX from "xlsx";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import TuneIcon from "@mui/icons-material/Tune";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import EditIcon from "@mui/icons-material/Edit";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getStockList } from "../../../api/Inventory/StockListApi";
import { getItemCategories } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getBrands } from "../../../api/Brands/BrandsApi";
import { getSubcategories } from "../../../api/Subcategories/SubcategoriesApi";
import { createStockAdjustment, getStockAdjustments } from "../../../api/Pos/posOpsApi";
import { postInventoryAdjustment } from "../../../api/Inventory/InventoryTransactionApi";
import { getStockDamages, recordStockDamage, deleteStockDamage } from "../../../api/Pos/posApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import {
  getItems, bulkCreateStockMasters, bulkUpdateUnits, safeDeleteStockMasters, bulkInactivateStockMasters,
  type SafeDeleteResult,
} from "../../../api/Item/ItemApi";
import { getItemUnits } from "../../../api/ItemUnit/ItemUnitApi";
import { bulkUpsertSalesPricing } from "../../../api/SalesPricing/SalesPricingApi";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";
import { useOnlineStatus, getOrCreateTerminalId } from "../../../offline/useOnlineStatus";
import {
  isDesktopApp, saveReferenceData, getReferenceData,
  listProducts as listOfflineProducts, queuePendingStockDamage, listAllPendingStockDamages,
  deletePendingStockDamage, type PendingStockDamage,
} from "../../../offline/db";

/**
 * One "Stock" page — search/browse inventory, click a row's arrow to
 * expand its full details (category, subcategory, brand, barcode, cost)
 * inline, and adjust its stock right there. Browsing itself stays
 * read-only (no writes); the Adjust action calls the exact same genuine
 * createStockAdjustment flow the old standalone Stock Adjustments page
 * used — same accounting-safe stock-movement logic, just reached from
 * inside this same row instead of a separate screen/tab.
 */
export default function StockPage() {
  const [tab, setTab] = useState<"products" | "damage" | "bulk-price" | "bulk-add" | "bulk-qty">("products");

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Stock" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Stock" }]} />
        <Typography variant="caption" color="text.secondary">
          Search inventory — click the arrow on a product to see its full details and adjust stock.
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="products" label="Products" />
        <Tab value="damage" label="Stock Damage" />
        <Tab value="bulk-price" label="Bulk Price Update" />
        <Tab value="bulk-add" label="Bulk Add Products" />
        <Tab value="bulk-qty" label="Bulk Add Quantities" />
      </Tabs>

      {tab === "products" && <ProductsTab />}
      {tab === "damage" && <StockDamageTab />}
      {tab === "bulk-add" && <BulkAddProductsTab />}
      {tab === "bulk-qty" && <BulkAddQuantitiesTab />}
      {tab === "bulk-price" && <BulkPriceUpdateTab />}
    </FormPageLayout>
  );
}

// ---------------------------------------------------------------------------
// "Products" tab: the existing search/browse/expand/adjust stock browser.
// ---------------------------------------------------------------------------
function ProductsTab() {
  const { formatCurrency } = useHomeCurrency();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [subcategory, setSubcategory] = useState<any>(null);
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set());
  const [bulkUnitId, setBulkUnitId] = useState<number | "">("");
  const isOnline = useOnlineStatus();
  const isOffline = isDesktopApp() && !isOnline;
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories() });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => getBrands() });
  const { data: subcategories } = useQuery({ queryKey: ["subcategories"], queryFn: () => getSubcategories() });
  const { data: itemUnits } = useQuery({ queryKey: ["item-units"], queryFn: () => getItemUnits() });
  const { data: typedStockFromApi, isLoading } = useQuery({
    queryKey: ["stock-list", search, category?.category_id, brand?.id, subcategory?.id],
    queryFn: () => getStockList({
      search: search || undefined,
      category_id: category?.category_id,
      brand_id: brand?.id,
      subcategory_id: subcategory?.id,
    }),
  });

  // Singlish search, same as POS Checkout: "parippu" also searches "පරිප්පු".
  const sinhalaSearch = useMemo(() => toSinhalaSearch(search), [search]);
  const { data: sinhalaStockFromApi } = useQuery({
    queryKey: ["stock-list", sinhalaSearch, category?.category_id, brand?.id, subcategory?.id],
    queryFn: () => getStockList({
      search: sinhalaSearch,
      category_id: category?.category_id,
      brand_id: brand?.id,
      subcategory_id: subcategory?.id,
    }),
    enabled: sinhalaSearch.length > 0,
  });
  const stockFromApi = useMemo(() => {
    if (!typedStockFromApi) return undefined;
    if (!sinhalaSearch || !sinhalaStockFromApi) return typedStockFromApi;
    const seen = new Set(typedStockFromApi.map((s: any) => String(s.stock_id)));
    return [...typedStockFromApi, ...sinhalaStockFromApi.filter((s: any) => !seen.has(String(s.stock_id)))];
  }, [typedStockFromApi, sinhalaStockFromApi, sinhalaSearch]);

  // A separate, always-unfiltered fetch purely to keep a full offline
  // snapshot current — the filtered query above only ever holds whatever
  // the cashier last searched for, which isn't enough to browse offline.
  const { data: fullStockFromApi } = useQuery({ queryKey: ["stock-list-all"], queryFn: () => getStockList() });
  const [offlineStock, setOfflineStock] = useState<any[]>([]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    getReferenceData<any[]>("stock_list").then((v) => v && setOfflineStock(v)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isDesktopApp() || !fullStockFromApi || fullStockFromApi.length === 0) return;
    saveReferenceData("stock_list", fullStockFromApi).catch(() => {});
  }, [fullStockFromApi]);

  // Offline: filter the cached full snapshot client-side the same way the
  // server would, since there's nothing to send the search/category to.
  const stock = isOffline
    ? offlineStock.filter((s: any) => {
        const matchesSearch = !search || [s.description, s.stock_id, s.barcode].some((v) => {
          const value = String(v ?? "").toLowerCase();
          return value.includes(search.toLowerCase()) || (!!sinhalaSearch && value.includes(sinhalaSearch));
        });
        const matchesCategory = !category?.category_id || s.category_id === category.category_id;
        const matchesBrand = !brand?.id || s.brand_id === brand.id;
        const matchesSubcategory = !subcategory?.id || s.subcategory_id === subcategory.id;
        return matchesSearch && matchesCategory && matchesBrand && matchesSubcategory;
      })
    : (stockFromApi ?? []);

  const toggleSelected = (stockId: string) => {
    setSelectedStockIds((prev) => {
      const next = new Set(prev);
      if (next.has(stockId)) next.delete(stockId); else next.add(stockId);
      return next;
    });
  };

  const allVisibleSelected = (stock ?? []).length > 0 && (stock ?? []).every((s: any) => selectedStockIds.has(s.stock_id));
  const toggleSelectAll = () => {
    setSelectedStockIds(allVisibleSelected ? new Set() : new Set((stock ?? []).map((s: any) => s.stock_id)));
  };

  const bulkUnitMutation = useMutation({
    mutationFn: () => bulkUpdateUnits(Array.from(selectedStockIds), Number(bulkUnitId)),
    onSuccess: () => {
      notify.success(`Unit applied to ${selectedStockIds.size} product(s)`);
      setSelectedStockIds(new Set());
      setBulkUnitId("");
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to apply unit"),
  });

  // Delete flow: confirm → server deletes only never-used items → for the
  // rest, offer Make Inactive (keeps sales/stock history intact).
  const [deleteTargets, setDeleteTargets] = useState<{ stock_id: string; description: string }[]>([]);
  const [deleteResult, setDeleteResult] = useState<SafeDeleteResult | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => safeDeleteStockMasters(deleteTargets.map((t) => t.stock_id)),
    onSuccess: (result) => {
      setDeleteTargets([]);
      setSelectedStockIds((prev) => {
        const next = new Set(prev);
        result.deleted.forEach((id) => next.delete(id));
        return next;
      });
      if (result.deleted.length > 0) {
        setExpandedStockId(null);
        notify.success(`${result.deleted.length} product(s) deleted`);
        queryClient.invalidateQueries({ queryKey: ["stock-list"] });
        queryClient.invalidateQueries({ queryKey: ["stock-list-all"] });
      }
      if (result.blocked.length > 0) setDeleteResult(result);
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to delete product(s)"),
  });

  const inactiveMutation = useMutation({
    mutationFn: (stockIds: string[]) => bulkInactivateStockMasters(stockIds),
    onSuccess: (_, stockIds) => {
      notify.success(`${stockIds.length} product(s) made inactive`);
      setDeleteResult(null);
      setSelectedStockIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      queryClient.invalidateQueries({ queryKey: ["stock-list-all"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to make product(s) inactive"),
  });

  const askDelete = (items: any[]) =>
    setDeleteTargets(items.map((s: any) => ({ stock_id: String(s.stock_id), description: String(s.description ?? "") })));

  const handleExportExcel = () => {
    const rows = (stock ?? []).map((s: any) => ({
      Product: s.description,
      "Stock ID": s.stock_id,
      Barcode: s.barcode ?? "",
      Category: s.category_name ?? "",
      Subcategory: s.subcategory_name ?? "",
      Brand: s.brand_name ?? "",
      "Purchase Cost": s.purchase_cost ?? 0,
      "Quantity on Hand": s.quantity ?? 0,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock");
    XLSX.writeFile(workbook, `stock-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
        <Button
          variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportExcel}
          sx={{ whiteSpace: "nowrap" }}
        >
          Export Excel
        </Button>
      </Stack>

      {selectedStockIds.size > 0 && (
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "primary.main", borderRadius: 3, mb: 2 }}>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
              <Typography variant="body2" fontWeight={600}>
                {selectedStockIds.size} product(s) selected
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  label="Unit"
                  value={bulkUnitId}
                  onChange={(e) => setBulkUnitId(e.target.value as number)}
                >
                  {(itemUnits ?? []).map((u: any) => (
                    <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                disabled={!bulkUnitId || bulkUnitMutation.isPending}
                onClick={() => bulkUnitMutation.mutate()}
              >
                {bulkUnitMutation.isPending ? "Applying..." : "Apply Unit to Selected"}
              </Button>
              <Button
                variant="outlined" color="error" startIcon={<DeleteIcon />}
                disabled={isOffline || deleteMutation.isPending}
                onClick={() => askDelete((stock ?? []).filter((s: any) => selectedStockIds.has(s.stock_id)))}
              >
                Delete Selected
              </Button>
              <Button variant="text" onClick={() => setSelectedStockIds(new Set())}>Clear Selection</Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth size="small"
              placeholder="Search by name, stock ID, or barcode — scan or type"
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Autocomplete
              sx={{ minWidth: 200 }}
              options={categories ?? []}
              getOptionLabel={(c: any) => c.description ?? ""}
              value={category}
              onChange={(_, v) => setCategory(v)}
              renderInput={(p) => <TextField {...p} label="Category" size="small" />}
            />
            <Autocomplete
              sx={{ minWidth: 200 }}
              options={brands ?? []}
              getOptionLabel={(b: any) => b.name ?? ""}
              value={brand}
              onChange={(_, v) => setBrand(v)}
              renderInput={(p) => <TextField {...p} label="Brand" size="small" />}
            />
            <Autocomplete
              sx={{ minWidth: 200 }}
              options={subcategories ?? []}
              getOptionLabel={(sc: any) => sc.name ?? ""}
              value={subcategory}
              onChange={(_, v) => setSubcategory(v)}
              renderInput={(p) => <TextField {...p} label="Subcategory" size="small" />}
            />
          </Stack>
        </CardContent>
      </Card>

      {isOffline && (
        <Chip label="Offline — showing the last synced stock snapshot" color="warning" size="small" sx={{ mb: 2 }} />
      )}

      {isLoading && !isOffline ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={allVisibleSelected} onChange={toggleSelectAll} />
                </TableCell>
                <TableCell width={48} />
                <TableCell>Product</TableCell>
                <TableCell>Stock ID</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell align="right">Purchase Cost (LKR)</TableCell>
                <TableCell align="right">Selling Price (LKR)</TableCell>
                <TableCell align="right">Quantity on Hand</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(stock ?? []).map((s: any) => {
                const isOpen = expandedStockId === s.stock_id;
                return (
                  <Fragment key={s.stock_id}>
                    <TableRow hover selected={selectedStockIds.has(s.stock_id)}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selectedStockIds.has(s.stock_id)} onChange={() => toggleSelected(s.stock_id)} />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => setExpandedStockId(isOpen ? null : s.stock_id)}>
                          {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell>{s.description}</TableCell>
                      <TableCell>{s.stock_id}</TableCell>
                      <TableCell>{s.category_name ?? "—"}</TableCell>
                      <TableCell>{s.unit_name ?? "—"}</TableCell>
                      <TableCell align="right">{Number(s.purchase_cost).toLocaleString()}</TableCell>
                      <TableCell align="right">{s.selling_price != null ? Number(s.selling_price).toLocaleString() : "—"}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={s.quantity} color={s.quantity <= 0 ? "error" : "default"} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={9} sx={{ py: 0, borderBottom: isOpen ? undefined : "none" }}>
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <ProductDetailPanel product={s} onDelete={isOffline ? undefined : () => askDelete([s])} />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
              {(!stock || stock.length === 0) && (
                <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2">No matching products.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={deleteTargets.length > 0} onClose={() => !deleteMutation.isPending && setDeleteTargets([])} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {deleteTargets.length === 1 ? "product" : `${deleteTargets.length} products`}?</DialogTitle>
        <DialogContent>
          {deleteTargets.length === 1 ? (
            <Typography variant="body2">
              Delete <b>{deleteTargets[0].description}</b> ({deleteTargets[0].stock_id})? This can't be undone.
            </Typography>
          ) : (
            <Typography variant="body2">This can't be undone.</Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Products that already have sales, purchases or stock are not deleted — you can make them Inactive instead.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTargets([])} disabled={deleteMutation.isPending}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteResult} onClose={() => !inactiveMutation.isPending && setDeleteResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {deleteResult && deleteResult.deleted.length > 0
            ? `${deleteResult.deleted.length} deleted, ${deleteResult.blocked.length} kept`
            : "Product(s) not deleted"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            These products have history, so they were kept to protect your sales and stock records:
          </Typography>
          <Table size="small">
            <TableBody>
              {(deleteResult?.blocked ?? []).map((b) => (
                <TableRow key={b.stock_id}>
                  <TableCell>{b.description ?? b.stock_id} ({b.stock_id})</TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{b.reason}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Make Inactive stops them being scanned at the POS and hides them from the Stock list, while keeping all history.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteResult(null)} disabled={inactiveMutation.isPending}>Close</Button>
          <Button
            variant="contained"
            disabled={inactiveMutation.isPending || !(deleteResult?.blocked ?? []).some((b) => b.reason !== "Product not found.")}
            onClick={() => inactiveMutation.mutate((deleteResult?.blocked ?? []).filter((b) => b.reason !== "Product not found.").map((b) => b.stock_id))}
          >
            {inactiveMutation.isPending ? "Saving..." : "Make Inactive"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// "Stock Damage" tab — moved as-is from the old standalone StockDamagePage,
// same genuine recordStockDamage/deleteStockDamage backend calls.
// ---------------------------------------------------------------------------
const emptyDamageForm = { stock_id: null as any, quantity: "1", reason: "", damage_date: new Date().toISOString().slice(0, 10) };

function StockDamageTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDamageForm);
  const isOnline = useOnlineStatus();
  const isOffline = isDesktopApp() && !isOnline;

  const { data: damagesFromApi, isLoading } = useQuery({ queryKey: ["stock-damages"], queryFn: () => getStockDamages() });
  const { data: itemsFromApi } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  // Full stock list (barcode, unit, stock on hand) so the Product dropdown can show details.
  const { data: stockDetailsFromApi } = useQuery({ queryKey: ["stock-list-all"], queryFn: () => getStockList() });
  const [offlineDamages, setOfflineDamages] = useState<any[]>([]);
  const [offlineItems, setOfflineItems] = useState<any[]>([]);
  const [offlineStockDetails, setOfflineStockDetails] = useState<any[]>([]);
  const [pendingDamages, setPendingDamages] = useState<PendingStockDamage[]>([]);

  const refreshPendingDamages = () => {
    if (!isDesktopApp()) return;
    listAllPendingStockDamages().then(setPendingDamages).catch(() => {});
  };

  useEffect(() => {
    if (!isDesktopApp()) return;
    getReferenceData<any[]>("stock_damages").then((v) => v && setOfflineDamages(v)).catch(() => {});
    getReferenceData<any[]>("stock_list").then((v) => v && setOfflineStockDetails(v)).catch(() => {});
    listOfflineProducts().then((rows) =>
      setOfflineItems(rows.map((r) => ({ stock_id: r.stock_id, description: r.description })))
    ).catch(() => {});
    refreshPendingDamages();
  }, []);

  useEffect(() => {
    if (!isDesktopApp() || !damagesFromApi || damagesFromApi.length === 0) return;
    saveReferenceData("stock_damages", damagesFromApi).catch(() => {});
  }, [damagesFromApi]);

  const items =
    stockDetailsFromApi && stockDetailsFromApi.length > 0 ? stockDetailsFromApi
    : itemsFromApi && itemsFromApi.length > 0 ? itemsFromApi
    : offlineStockDetails.length > 0 ? offlineStockDetails
    : offlineItems;

  // Product search: name, stock ID, barcode — plus Singlish ("kakar" → "කැකර්").
  const filterDamageProducts = (options: any[], { inputValue }: { inputValue: string }) => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return options;
    const sinhala = toSinhalaSearch(inputValue);
    return options.filter((i: any) => {
      const name = String(i.description ?? "").toLowerCase();
      return name.includes(term)
        || String(i.stock_id ?? "").toLowerCase().includes(term)
        || String(i.barcode ?? "").includes(inputValue.trim())
        || (!!sinhala && name.includes(sinhala));
    });
  };

  const createMutation = useMutation({
    mutationFn: recordStockDamage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-damages"] });
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      setOpen(false);
      setForm(emptyDamageForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStockDamage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-damages"] });
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    },
  });

  const handleSubmit = async () => {
    if (!form.stock_id) return;

    if (isOffline) {
      await queuePendingStockDamage({
        uuid: crypto.randomUUID(),
        terminal_id: getOrCreateTerminalId(),
        stock_id: form.stock_id.stock_id,
        description: form.stock_id.description ?? null,
        quantity: Number(form.quantity) || 0,
        reason: form.reason || null,
        damage_date: form.damage_date,
        created_at: new Date().toISOString(),
      });
      notify.success("Damage recorded offline — it will sync automatically once the connection is back");
      setOpen(false);
      setForm(emptyDamageForm);
      refreshPendingDamages();
      return;
    }

    createMutation.mutate({
      stock_id: form.stock_id.stock_id,
      quantity: Number(form.quantity) || 0,
      reason: form.reason,
      damage_date: form.damage_date,
    });
  };

  const handleDelete = async (row: any) => {
    if (row._offlinePending) {
      await deletePendingStockDamage(row._uuid);
      refreshPendingDamages();
      return;
    }
    if (isOffline) {
      notify.error("Can't delete a synced damage record while offline");
      return;
    }
    deleteMutation.mutate(row.id);
  };

  // Offline: show whatever was synced down last, plus anything queued
  // locally on top (clearly marked, since it hasn't reached the server yet).
  const damages = isOffline
    ? [
        ...pendingDamages.map((d) => ({
          id: d.uuid, stock: { description: d.description }, stock_id: d.stock_id,
          quantity: d.quantity, reason: d.reason, damage_date: d.damage_date,
          _offlinePending: true, _uuid: d.uuid, _syncFailed: !!d.sync_error,
        })),
        ...offlineDamages,
      ]
    : (damagesFromApi ?? []);

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        {isOffline ? (
          <Chip label="Offline — showing the last synced list + anything recorded locally" color="warning" size="small" />
        ) : <span />}
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Record Damage</Button>
      </Box>

      {isLoading && !isOffline ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(damages ?? []).map((d: any) => (
                <TableRow key={d.id} hover>
                  <TableCell>{d.stock?.description ?? d.stock_id}</TableCell>
                  <TableCell align="right">{d.quantity}</TableCell>
                  <TableCell>{d.reason ?? "—"}</TableCell>
                  <TableCell>{String(d.damage_date).slice(0, 10)}</TableCell>
                  <TableCell align="center">
                    {d._offlinePending ? (
                      <Chip size="small" color={d._syncFailed ? "error" : "warning"} label={d._syncFailed ? "Sync failed" : "Pending sync"} />
                    ) : (
                      <Chip size="small" color="success" label="Synced" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => handleDelete(d)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!damages || damages.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No damaged stock recorded.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Stock Damage</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={items ?? []}
              getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              filterOptions={filterDamageProducts}
              isOptionEqualToValue={(a: any, b: any) => String(a?.stock_id) === String(b?.stock_id)}
              value={form.stock_id}
              onChange={(_, val) => setForm({ ...form, stock_id: val })}
              renderOption={(props, option: any) => (
                <li {...props} key={option.stock_id}>
                  <Stack>
                    <Typography variant="body2">{option.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[
                        option.stock_id,
                        option.barcode ? `Barcode: ${option.barcode}` : null,
                        option.unit_name ?? null,
                        option.quantity != null ? `Stock: ${option.quantity}` : null,
                      ].filter(Boolean).join(" · ")}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Product" placeholder="Search name, stock ID or barcode" />
              )}
            />
            <TextField label="Quantity Damaged" type="number" fullWidth value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <TextField label="Reason" fullWidth value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <TextField label="Damage Date" type="date" fullWidth value={form.damage_date} onChange={(e) => setForm({ ...form, damage_date: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.stock_id || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Expanded row: full product details + an "Adjust Stock" action.
// ---------------------------------------------------------------------------
function ProductDetailPanel({ product, onDelete }: { product: any; onDelete?: () => void }) {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [locCode, setLocCode] = useState("");
  const [movementType, setMovementType] = useState<"add" | "reduce" | "override">("add");
  const [quantity, setQuantity] = useState("0");
  const [reason, setReason] = useState("");

  const emptyEditForm = () => ({
    description: product.description ?? "",
    category_name: product.category_name ?? "",
    subcategory_name: product.subcategory_name ?? "",
    brand_name: product.brand_name ?? "",
    unit_id: product.units ?? "",
    purchase_cost: String(product.purchase_cost ?? ""),
    selling_price: String(product.selling_price ?? ""),
    mrp_price: String(product.mrp_price ?? ""),
    barcode: product.barcode ?? "",
  });

  const [editForm, setEditForm] = useState(emptyEditForm);

  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations, enabled: adjustOpen });
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["stock-adjustments", product.stock_id],
    queryFn: () => getStockAdjustments(product.stock_id),
    enabled: historyOpen,
  });

  const { data: editCategories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories(), enabled: editOpen });
  const { data: editSubcategories } = useQuery({ queryKey: ["subcategories"], queryFn: () => getSubcategories(), enabled: editOpen });
  const { data: editBrands } = useQuery({ queryKey: ["brands"], queryFn: () => getBrands(), enabled: editOpen });
  const { data: editUnits } = useQuery({ queryKey: ["item-units"], queryFn: () => getItemUnits(), enabled: editOpen });

  const editMutation = useMutation({
    mutationFn: async () => {
      const price = Number(editForm.selling_price) || 0;
      await bulkUpsertSalesPricing([{
        stock_id: product.stock_id,
        currency_id: 8,
        sales_type_id: 3,
        price,
        description: editForm.description || undefined,
        purchase_cost: editForm.purchase_cost !== "" ? Number(editForm.purchase_cost) : undefined,
        mrp_price: editForm.mrp_price !== "" ? Number(editForm.mrp_price) : undefined,
        category: editForm.category_name || undefined,
        subcategory: editForm.subcategory_name || undefined,
        brand: editForm.brand_name || undefined,
        barcode: editForm.barcode || undefined,
      }]);
      if (editForm.unit_id && String(editForm.unit_id) !== String(product.units)) {
        await bulkUpdateUnits([product.stock_id], Number(editForm.unit_id));
      }
    },
    onSuccess: () => {
      notify.success("Item updated");
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      setEditOpen(false);
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to update item"),
  });

  const adjustMutation = useMutation({
    mutationFn: () => createStockAdjustment({
      stock_id: product.stock_id,
      loc_code: locCode,
      movement_type: movementType,
      quantity: Number(quantity) || 0,
      reason,
    }),
    onSuccess: () => {
      notify.success("Stock adjusted");
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      setAdjustOpen(false);
      setLocCode("");
      setMovementType("add");
      setQuantity("0");
      setReason("");
    },
    onError: () => notify.error("Failed to adjust stock"),
  });

  return (
    <Box sx={{ py: 2, px: 1 }}>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Category</Typography>
          <Typography variant="body2">{product.category_name ?? "—"}</Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Subcategory</Typography>
          <Typography variant="body2">{product.subcategory_name ?? "—"}</Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Brand</Typography>
          <Typography variant="body2">{product.brand_name ?? "—"}</Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Barcode</Typography>
          <Typography variant="body2">{product.barcode ?? "No barcode linked"}</Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Unit</Typography>
          <Typography variant="body2">{product.unit_name ?? "—"}</Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Purchase Cost</Typography>
          <Typography variant="body2">{formatCurrency(product.purchase_cost)}</Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Quantity on Hand</Typography>
          <Typography variant="body2">{product.quantity}</Typography>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} alignItems="center">
        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => { setEditForm(emptyEditForm()); setEditOpen(true); }}>
          Edit Item
        </Button>
        <Button size="small" variant="outlined" startIcon={<TuneIcon />} onClick={() => setAdjustOpen(true)}>
          Adjust Stock
        </Button>
        {onDelete && (
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
            Delete Item
          </Button>
        )}
        <Tooltip title="Adjustment History">
          <IconButton size="small" onClick={() => setHistoryOpen(true)}>
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Item — {product.stock_id}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Description" fullWidth value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
            <Autocomplete
              options={(editCategories ?? []).map((c: any) => c.description ?? "")}
              freeSolo
              value={editForm.category_name}
              onInputChange={(_, val) => setEditForm({ ...editForm, category_name: val })}
              renderInput={(p) => <TextField {...p} label="Category" />}
            />
            <Autocomplete
              options={(editSubcategories ?? []).map((s: any) => s.name ?? "")}
              freeSolo
              value={editForm.subcategory_name}
              onInputChange={(_, val) => setEditForm({ ...editForm, subcategory_name: val })}
              renderInput={(p) => <TextField {...p} label="Subcategory" />}
            />
            <Autocomplete
              options={(editBrands ?? []).map((b: any) => b.name ?? "")}
              freeSolo
              value={editForm.brand_name}
              onInputChange={(_, val) => setEditForm({ ...editForm, brand_name: val })}
              renderInput={(p) => <TextField {...p} label="Brand" />}
            />
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select value={editForm.unit_id} label="Unit" onChange={(e) => setEditForm({ ...editForm, unit_id: e.target.value })}>
                {(editUnits ?? []).map((u: any) => (
                  <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Purchase Cost (LKR)" type="number" fullWidth value={editForm.purchase_cost}
              onChange={(e) => setEditForm({ ...editForm, purchase_cost: e.target.value })}
            />
            <TextField
              label="Selling Price (LKR)" type="number" fullWidth value={editForm.selling_price}
              onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
            />
            <TextField
              label="MRP Price (LKR)" type="number" fullWidth value={editForm.mrp_price}
              onChange={(e) => setEditForm({ ...editForm, mrp_price: e.target.value })}
            />
            <TextField
              label="Barcode" fullWidth value={editForm.barcode}
              onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>
            {editMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Adjustment History — {product.description}</DialogTitle>
        <DialogContent dividers>
          {historyLoading ? (
            <Typography variant="body2" color="text.secondary">Loading...</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Before</TableCell>
                    <TableCell align="right">Moved</TableCell>
                    <TableCell align="right">After</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(history ?? []).map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell>{String(h.created_at).slice(0, 16).replace("T", " ")}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={h.movement_type}
                          color={h.movement_type === "add" ? "success" : h.movement_type === "reduce" ? "error" : "default"}
                        />
                      </TableCell>
                      <TableCell align="right">{h.quantity_before}</TableCell>
                      <TableCell align="right">{Number(h.quantity_moved) > 0 ? `+${h.quantity_moved}` : h.quantity_moved}</TableCell>
                      <TableCell align="right">{h.quantity_after}</TableCell>
                      <TableCell>{h.reason ?? "—"}</TableCell>
                      <TableCell>
                        {h.recorded_by_user
                          ? `${h.recorded_by_user.first_name} ${h.recorded_by_user.last_name}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!history || history.length === 0) && (
                    <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2">No adjustments recorded for this item.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Adjust Stock — {product.description}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select value={locCode} label="Location" onChange={(e) => setLocCode(e.target.value)}>
                {(locations ?? []).map((loc: any) => (
                  <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Movement Type</InputLabel>
              <Select value={movementType} label="Movement Type" onChange={(e) => setMovementType(e.target.value as any)}>
                <MenuItem value="add">Add Stock</MenuItem>
                <MenuItem value="reduce">Reduce Stock</MenuItem>
                <MenuItem value="override">Override (set exact quantity)</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Quantity" type="number" fullWidth value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <TextField label="Reason" fullWidth value={reason} onChange={(e) => setReason(e.target.value)} placeholder="waste / damage / general / count correction" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!locCode || adjustMutation.isPending} onClick={() => adjustMutation.mutate()}>
            {adjustMutation.isPending ? "Saving..." : "Apply Adjustment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// "Bulk Price Update" tab: upload an .xlsx with stock_id + price (required),
// plus optional columns — sales_type_id, mrp_price, expiry_date, category_id,
// subcategory_id, brand_id, barcode — then push it through the same
// sales_pricing upsert / stock_master field updates / item_codes barcode
// link the single-product Set Price screen already uses, just looped
// server-side over many rows. Parsing happens entirely in the browser
// (existing "xlsx" package, already used for the Products export on this
// same page). The optional columns are all classification/master-data
// fields, never the GL account fields on stock_master, so this still can't
// touch accounting.
// ---------------------------------------------------------------------------
const BULK_PRICE_LKR_CURRENCY_ID = 8;
const BULK_PRICE_RETAIL_SALES_TYPE_ID = 3;

type BulkPriceRow = {
  stock_id: string;
  price: number;
  currency_id: number;
  sales_type_id: number;
  description?: string;
  mrp_price?: number;
  expiry_date?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  barcode?: string;
  purchase_cost?: number;
};

function BulkPriceUpdateTab() {
  const [rows, setRows] = useState<BulkPriceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ updated: number; created: number; errors: any[] } | null>(null);

  // Powers "Download Current Products" below — the real product list with
  // its real current values, so the sheet you edit and re-upload is a
  // genuine export/re-import round trip, not a blank guess-the-columns form.
  const { data: currentStock } = useQuery({ queryKey: ["stock-list-all-for-bulk-price"], queryFn: () => getStockList({}) });

  const bulkMutation = useMutation({
    mutationFn: () => bulkUpsertSalesPricing(rows),
    onSuccess: (data) => {
      setResult(data);
      notify.success(`Prices updated: ${data.created} created, ${data.updated} updated${data.errors?.length ? `, ${data.errors.length} skipped` : ""}`);
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Bulk price update failed"),
  });

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed: any[] = XLSX.utils.sheet_to_json(sheet);
      const mapped: BulkPriceRow[] = parsed
        .map((r) => ({
          stock_id: String(r.stock_id ?? r.Stock_ID ?? r["Stock ID"] ?? "").trim(),
          price: Number(r.selling_price ?? r.price ?? r.Price ?? 0),
          currency_id: BULK_PRICE_LKR_CURRENCY_ID,
          sales_type_id: BULK_PRICE_RETAIL_SALES_TYPE_ID,
          description: r.description ? String(r.description).trim() : undefined,
          purchase_cost: r.purchase_cost !== undefined && r.purchase_cost !== "" ? Number(r.purchase_cost) : undefined,
          mrp_price: r.mrp_price !== undefined && r.mrp_price !== "" ? Number(r.mrp_price) : undefined,
          expiry_date: r.expiry_date ? String(r.expiry_date).slice(0, 10) : undefined,
          category: r.category ? String(r.category).trim() : undefined,
          subcategory: r.subcategory ? String(r.subcategory).trim() : undefined,
          brand: r.brand ? String(r.brand).trim() : undefined,
          barcode: r.barcode ? String(r.barcode).trim() : undefined,
        }))
        .filter((r) => r.stock_id && r.price > 0);
      setRows(mapped);
      if (mapped.length === 0) {
        notify.error("No valid rows found — the sheet needs stock_id and selling_price columns");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Column widths so headers and values (barcodes, long descriptions) show
  // in full instead of being visually cut off — same order the sheets below
  // write their columns in.
  const BULK_PRICE_COLUMN_WIDTHS = [
    { wch: 12 }, // stock_id
    { wch: 30 }, // description
    { wch: 14 }, // category
    { wch: 14 }, // subcategory
    { wch: 12 }, // brand
    { wch: 18 }, // barcode
    { wch: 14 }, // purchase_cost
    { wch: 14 }, // selling_price
    { wch: 12 }, // mrp_price
  ];

  // The one people actually want: every existing product with its real
  // stock_id and current values already filled in — edit only the cells
  // that need to change, then re-upload the same file.
  const downloadCurrentProducts = () => {
    const list = currentStock ?? [];
    if (list.length === 0) {
      notify.error("Product list hasn't loaded yet — try again in a moment");
      return;
    }
    const sheetRows = list.map((s: any) => ({
      stock_id: s.stock_id,
      description: s.description ?? "",
      category: s.category_name ?? "",
      subcategory: s.subcategory_name ?? "",
      brand: s.brand_name ?? "",
      barcode: s.barcode ?? "",
      purchase_cost: s.purchase_cost ?? "",
      selling_price: s.selling_price ?? "",
      mrp_price: s.mrp_price ?? "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    worksheet["!cols"] = BULK_PRICE_COLUMN_WIDTHS;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prices");
    XLSX.writeFile(workbook, `current-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Bulk Price Update</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          Click <b>Download Current Products</b> to get every product with its current values, edit whichever
          cells need to change, then upload that same file back. Required: <b>stock_id</b> and <b>selling_price</b>.
          Optional: <b>purchase_cost</b>, <b>mrp_price</b>, <b>description</b>, <b>category</b>, <b>subcategory</b>,
          {" "}<b>brand</b>, <b>barcode</b> — leave blank to keep unchanged.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Button variant="outlined" startIcon={<UploadFileIcon />} component="label">
            Choose File
            <input
              type="file" hidden accept=".xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </Button>
          {fileName && <Typography variant="body2">{fileName} — {rows.length} valid row(s)</Typography>}
          <Button variant="contained" size="small" onClick={downloadCurrentProducts}>Download Current Products</Button>
        </Stack>

        {rows.length > 0 && (
          <>
            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 320, mb: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Stock ID</TableCell><TableCell>Description</TableCell><TableCell align="right">Price</TableCell>
                    <TableCell align="right">MRP</TableCell><TableCell>Expiry</TableCell>
                    <TableCell>Category</TableCell><TableCell>Subcategory</TableCell><TableCell>Brand</TableCell>
                    <TableCell>Barcode</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.stock_id}</TableCell>
                      <TableCell>{r.description ?? "—"}</TableCell>
                      <TableCell align="right">{r.price}</TableCell>
                      <TableCell align="right">{r.mrp_price ?? "—"}</TableCell>
                      <TableCell>{r.expiry_date ?? "—"}</TableCell>
                      <TableCell>{r.category ?? "—"}</TableCell>
                      <TableCell>{r.subcategory ?? "—"}</TableCell>
                      <TableCell>{r.brand ?? "—"}</TableCell>
                      <TableCell>{r.barcode ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              variant="contained" disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
            >
              {bulkMutation.isPending ? "Applying..." : `Apply ${rows.length} Price Update(s)`}
            </Button>
          </>
        )}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Created: {result.created} · Updated: {result.updated} · Skipped: {result.errors?.length ?? 0}</Typography>
            {result.errors?.length > 0 && (
              <TableContainer component={Paper} elevation={0} sx={{ mt: 1, maxHeight: 200 }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Row</TableCell><TableCell>Stock ID</TableCell><TableCell>Error</TableCell></TableRow></TableHead>
                  <TableBody>
                    {result.errors.map((e: any, i: number) => (
                      <TableRow key={i}><TableCell>{e.row}</TableCell><TableCell>{e.stock_id}</TableCell><TableCell>{e.message}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// "Bulk Add Products" tab: create brand-new products from an .xlsx. The
// sheet only ever asks for fields a store owner actually understands — name,
// category, subcategory, brand, unit, cost, price, barcode. Every
// accounting/GL field a product still needs (tax type, item type, GL
// accounts, depreciation) is filled in automatically on the server from an
// existing product's setup — never shown here, never typed by hand.
// ---------------------------------------------------------------------------
const BULK_ADD_COLUMNS = [
  "stock_id", "description", "category", "subcategory", "brand", "units",
  "purchase_cost", "selling_price", "mrp_price", "barcode",
];

function BulkAddProductsTab() {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null);

  const bulkAddMutation = useMutation({
    mutationFn: () => bulkCreateStockMasters(rows),
    onSuccess: (data) => {
      setResult(data);
      notify.success(`Products created: ${data.created}${data.errors?.length ? `, ${data.errors.length} skipped` : ""}`);
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Bulk add failed"),
  });

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed: any[] = XLSX.utils.sheet_to_json(sheet);
      const mapped = parsed
        .filter((r) => String(r.stock_id ?? "").trim() && String(r.description ?? "").trim())
        .map((r) => {
          const row: Record<string, any> = {};
          for (const col of BULK_ADD_COLUMNS) {
            if (r[col] === undefined || r[col] === "") continue;
            row[col] = r[col];
          }
          return row;
        });
      setRows(mapped);
      if (mapped.length === 0) {
        notify.error("No valid rows found — each row needs at least stock_id and description");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const exampleRow = {
      stock_id: "NEWITEM001", description: "New Product Name", category: "", subcategory: "", brand: "",
      units: "", purchase_cost: 0, selling_price: 0, mrp_price: "", barcode: "",
    };
    const worksheet = XLSX.utils.json_to_sheet([exampleRow], { header: BULK_ADD_COLUMNS });
    worksheet["!cols"] = BULK_ADD_COLUMNS.map(() => ({ wch: 16 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "New Products");
    XLSX.writeFile(workbook, "bulk-add-products-template.xlsx");
  };

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Bulk Add Products</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          Creates brand-new products — download the template, fill in <b>stock_id</b>, <b>description</b> and{" "}
          <b>purchase_cost</b> (required), plus optional <b>category</b>, <b>subcategory</b>, <b>brand</b>,{" "}
          <b>units</b> (by name — e.g. "Beverages", "kg"), <b>selling_price</b>, <b>mrp_price</b>, and{" "}
          <b>barcode</b>, then upload it back.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Button variant="outlined" startIcon={<UploadFileIcon />} component="label">
            Choose File
            <input
              type="file" hidden accept=".xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </Button>
          {fileName && <Typography variant="body2">{fileName} — {rows.length} valid row(s)</Typography>}
          <Button variant="contained" size="small" onClick={downloadTemplate}>Download Template</Button>
        </Stack>

        {rows.length > 0 && (
          <>
            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 320, mb: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Stock ID</TableCell><TableCell>Description</TableCell><TableCell>Category</TableCell>
                    <TableCell>Brand</TableCell><TableCell>Units</TableCell>
                    <TableCell align="right">Cost</TableCell><TableCell align="right">Selling Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.stock_id}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell>{r.category ?? "—"}</TableCell>
                      <TableCell>{r.brand ?? "—"}</TableCell>
                      <TableCell>{r.units ?? "—"}</TableCell>
                      <TableCell align="right">{r.purchase_cost ?? "—"}</TableCell>
                      <TableCell align="right">{r.selling_price ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              variant="contained" disabled={bulkAddMutation.isPending}
              onClick={() => bulkAddMutation.mutate()}
            >
              {bulkAddMutation.isPending ? "Creating..." : `Create ${rows.length} Product(s)`}
            </Button>
          </>
        )}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Created: {result.created} · Skipped: {result.errors?.length ?? 0}</Typography>
            {result.errors?.length > 0 && (
              <TableContainer component={Paper} elevation={0} sx={{ mt: 1, maxHeight: 200 }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Row</TableCell><TableCell>Stock ID</TableCell><TableCell>Error</TableCell></TableRow></TableHead>
                  <TableBody>
                    {result.errors.map((e: any, i: number) => (
                      <TableRow key={i}><TableCell>{e.row}</TableCell><TableCell>{e.stock_id}</TableCell><TableCell>{e.message}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function BulkAddQuantitiesTab() {
  const [rows, setRows] = useState<{ stock_id: string; description: string; quantity: number; standard_cost?: number }[]>([]);
  const [fileName, setFileName] = useState("");
  const [locCode, setLocCode] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const queryClient = useQueryClient();

  const { data: locations } = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: getInventoryLocations,
  });

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const parsed: any[] = XLSX.utils.sheet_to_json(sheet);
      const mapped = parsed
        .filter((r) => String(r.stock_id ?? "").trim() && Number(r.quantity ?? r.qty ?? 0) !== 0)
        .map((r) => ({
          stock_id: String(r.stock_id).trim(),
          description: String(r.description ?? "").trim(),
          quantity: Number(r.quantity ?? r.qty ?? 0),
          standard_cost: r.purchase_cost != null ? Number(r.purchase_cost) : undefined,
        }));
      setRows(mapped);
      if (mapped.length === 0) notify.error("No valid rows — each row needs stock_id and quantity");
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const example = [
      { stock_id: "ITEM001", description: "Milk 1L", quantity: 100, purchase_cost: 130 },
      { stock_id: "ITEM002", description: "Bread Loaf", quantity: 50, purchase_cost: 200 },
    ];
    const ws = XLSX.utils.json_to_sheet(example, { header: ["stock_id", "description", "quantity", "purchase_cost"] });
    ws["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 16 }];
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, "Qty Adjustment");
    XLSX.writeFile(wb2, "bulk-add-quantities-template.xlsx");
  };

  const handleApply = async () => {
    if (!locCode) { notify.error("Please select a location first"); return; }
    if (!rows.length) { notify.error("No rows to process"); return; }
    setProgress({ done: 0, total: rows.length });
    const errors: string[] = [];
    let success = 0;
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      try {
        await postInventoryAdjustment({
          loc_code: locCode,
          trans_date: new Date().toISOString().slice(0, 10),
          reference: "BULK-QTY",
          comments: "Bulk quantity adjustment via Stock page",
          lines: batch.map((r) => ({ stock_id: r.stock_id, quantity: r.quantity, standard_cost: r.standard_cost })),
        });
        success += batch.length;
      } catch (err: any) {
        const msg = err?.response?.data?.message || `Batch ${Math.floor(i / BATCH) + 1} failed`;
        errors.push(msg);
      }
      setProgress({ done: Math.min(i + BATCH, rows.length), total: rows.length });
    }
    setProgress(null);
    setResults({ success, errors });
    queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    if (errors.length === 0) notify.success(`Quantities added for ${success} items`);
    else notify.error(`${errors.length} batch(es) failed — check results below`);
  };

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Bulk Add Quantities</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          Download the template, fill in <b>stock_id</b> and <b>quantity</b> (required), plus optional <b>purchase_cost</b>, then upload to add stock via inventory adjustment.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Location</InputLabel>
            <Select value={locCode} label="Location" onChange={(e) => setLocCode(e.target.value)}>
              {(Array.isArray(locations) ? locations : []).map((l: any) => (
                <MenuItem key={l.loc_code} value={l.loc_code}>{l.location_name ?? l.loc_code}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<UploadFileIcon />} component="label">
            Choose File
            <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </Button>
          {fileName && <Typography variant="body2">{fileName} — {rows.length} valid row(s)</Typography>}
          <Button variant="outlined" size="small" onClick={downloadTemplate}>Download Template</Button>
        </Stack>

        {rows.length > 0 && (
          <>
            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 320, mb: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Stock ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Purchase Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.stock_id}</TableCell>
                      <TableCell>{r.description || "—"}</TableCell>
                      <TableCell align="right">{r.quantity}</TableCell>
                      <TableCell align="right">{r.standard_cost ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {progress && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption">Processing {progress.done} / {progress.total}...</Typography>
                <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
              </Box>
            )}

            <Button
              variant="contained"
              onClick={handleApply}
              disabled={!!progress || !locCode}
            >
              {progress ? "Processing..." : `Add Quantities (${rows.length} items)`}
            </Button>
          </>
        )}

        {results && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color={results.errors.length ? "error" : "success.main"}>
              {results.errors.length === 0 ? "SUCCESS:" : "ERROR:"} {results.success} items processed{results.errors.length ? `, ${results.errors.length} batch(es) failed` : " successfully"}
            </Typography>
            {results.errors.map((e, i) => (
              <Typography key={i} variant="caption" color="error" sx={{ display: "block" }}>{e}</Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
