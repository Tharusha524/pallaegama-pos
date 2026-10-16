import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Stack, TextField, Typography, FormControl, InputLabel, Select,
  MenuItem, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Checkbox, LinearProgress, Tabs, Tab, InputAdornment, Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getStockList } from "../../../api/Inventory/StockListApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { postInventoryAdjustment } from "../../../api/Inventory/InventoryTransactionApi";
import { notify } from "../../../services/notificationService";
import * as XLSX from "xlsx";

interface AdjLine { stock_id: string; description: string; quantity: number; standard_cost?: number; }

// ── Manual Bulk Tab ──────────────────────────────────────────────────────────
function ManualBulkTab() {
  const queryClient = useQueryClient();
  const [locCode, setLocCode] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSubcategory, setFilterSubcategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [commonQty, setCommonQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: allStock, isLoading } = useQuery({
    queryKey: ["stock-list-bulk-adj"],
    queryFn: () => getStockList({ per_page: 9999 } as any),
  });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  const stockList: any[] = useMemo(() => {
    const raw = Array.isArray(allStock) ? allStock : (allStock as any)?.data ?? [];
    return raw.filter((s: any) => Number(s.mb_flag ?? 0) !== 3); // exclude service items
  }, [allStock]);

  const categories = useMemo(() => [...new Set(stockList.map((s: any) => s.category ?? "").filter(Boolean))].sort(), [stockList]);
  const subcategories = useMemo(() => [...new Set(stockList.filter((s: any) => !filterCategory || s.category === filterCategory).map((s: any) => s.subcategory ?? "").filter(Boolean))].sort(), [stockList, filterCategory]);
  const brands = useMemo(() => [...new Set(stockList.filter((s: any) => (!filterCategory || s.category === filterCategory) && (!filterSubcategory || s.subcategory === filterSubcategory)).map((s: any) => s.brand ?? "").filter(Boolean))].sort(), [stockList, filterCategory, filterSubcategory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stockList.filter((s: any) => {
      if (filterCategory && s.category !== filterCategory) return false;
      if (filterSubcategory && s.subcategory !== filterSubcategory) return false;
      if (filterBrand && s.brand !== filterBrand) return false;
      if (!q) return true;
      return String(s.stock_id ?? "").toLowerCase().includes(q) || String(s.description ?? "").toLowerCase().includes(q);
    });
  }, [stockList, search, filterCategory, filterSubcategory, filterBrand]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s: any) => String(s.stock_id))));
    }
  };

  const applyCommonQty = () => {
    if (!commonQty) return;
    setQtyMap((prev) => {
      const next = { ...prev };
      selected.forEach((id) => { next[id] = commonQty; });
      return next;
    });
  };

  const getQty = (id: string) => qtyMap[id] ?? (commonQty || "1");

  const handleSubmit = async () => {
    if (!locCode) { notify.error("Please select a location"); return; }
    if (!selected.size) { notify.error("Select at least one item"); return; }
    const lines = Array.from(selected).map((id) => {
      const item = stockList.find((s: any) => String(s.stock_id) === id);
      return { stock_id: id, quantity: Number(getQty(id)) || 0, standard_cost: item?.purchase_cost ? Number(item.purchase_cost) : undefined };
    }).filter((l) => l.quantity > 0);
    if (!lines.length) { notify.error("All selected items have 0 quantity"); return; }
    setSubmitting(true);
    try {
      await postInventoryAdjustment({
        loc_code: locCode,
        trans_date: new Date().toISOString().slice(0, 10),
        reference: "BULK-ADJ",
        comments: "Bulk stock adjustment",
        lines,
      });
      notify.success(`Adjusted ${lines.length} item(s) successfully`);
      setSelected(new Set());
      setQtyMap({});
      setCommonQty("");
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    } catch (err: any) {
      notify.error(err?.response?.data?.message || "Adjustment failed");
    }
    setSubmitting(false);
  };

  const allChecked = filtered.length > 0 && selected.size === filtered.length;
  const someChecked = selected.size > 0 && selected.size < filtered.length;

  return (
    <Box>
      {/* Top controls */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Location</InputLabel>
          <Select value={locCode} label="Location" onChange={(e) => setLocCode(e.target.value)}>
            {(Array.isArray(locations) ? locations : []).map((l: any) => (
              <MenuItem key={l.loc_code} value={l.loc_code}>{l.location_name ?? l.loc_code}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small" placeholder="Search by item ID or name" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select value={filterCategory} label="Category" onChange={(e) => { setFilterCategory(e.target.value); setFilterSubcategory(""); setFilterBrand(""); }}>
            <MenuItem value="">All</MenuItem>
            {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Subcategory</InputLabel>
          <Select value={filterSubcategory} label="Subcategory" onChange={(e) => { setFilterSubcategory(e.target.value); setFilterBrand(""); }}>
            <MenuItem value="">All</MenuItem>
            {subcategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Brand</InputLabel>
          <Select value={filterBrand} label="Brand" onChange={(e) => setFilterBrand(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {brands.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {/* Common qty bar */}
      {selected.size > 0 && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={600}>{selected.size} item(s) selected</Typography>
          <TextField
            size="small" label="Common Qty" type="number" value={commonQty}
            onChange={(e) => setCommonQty(e.target.value)} sx={{ width: 130 }}
            inputProps={{ min: 0 }}
          />
          <Button variant="outlined" size="small" onClick={applyCommonQty} disabled={!commonQty}>
            Apply to Selected
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Apply Adjustment"}
          </Button>
        </Stack>
      )}

      {isLoading && <LinearProgress sx={{ mb: 1 }} />}

      <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 500, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "background.paper" } }}>
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />
              </TableCell>
              <TableCell>Stock ID</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Current Stock</TableCell>
              <TableCell align="right" sx={{ width: 130 }}>Adjust Qty</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((s: any) => {
              const id = String(s.stock_id);
              const checked = selected.has(id);
              return (
                <TableRow key={id} hover selected={checked} onClick={() => toggleOne(id)} sx={{ cursor: "pointer" }}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked} onChange={() => toggleOne(id)} onClick={(e) => e.stopPropagation()} />
                  </TableCell>
                  <TableCell>{s.stock_id}</TableCell>
                  <TableCell>{s.description}</TableCell>
                  <TableCell align="right">{s.quantity ?? s.qty ?? 0}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <TextField
                      size="small" type="number" value={getQty(id)}
                      onChange={(e) => setQtyMap((prev) => ({ ...prev, [id]: e.target.value }))}
                      sx={{ width: 90 }} inputProps={{ min: 0 }}
                      disabled={!checked}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary" py={2}>No items found</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {filtered.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          Showing {filtered.length} item(s)
        </Typography>
      )}
    </Box>
  );
}

// ── Excel Upload Tab ──────────────────────────────────────────────────────────
function ExcelBulkTab() {
  const queryClient = useQueryClient();
  const [locCode, setLocCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<AdjLine[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  const handleFile = (file: File) => {
    setFileName(file.name); setResults(null);
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
          comments: "Bulk quantity adjustment via Excel upload",
          lines: batch.map((r) => ({ stock_id: r.stock_id, quantity: r.quantity, standard_cost: r.standard_cost })),
        });
        success += batch.length;
      } catch (err: any) {
        errors.push(err?.response?.data?.message || `Batch ${Math.floor(i / BATCH) + 1} failed`);
      }
      setProgress({ done: Math.min(i + BATCH, rows.length), total: rows.length });
    }
    setProgress(null);
    setResults({ success, errors });
    queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    if (errors.length === 0) notify.success(`Quantities added for ${success} items`);
    else notify.error(`${errors.length} batch(es) failed`);
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
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

      {progress && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>Processing {progress.done} / {progress.total}…</Typography>
          <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
        </Box>
      )}

      {rows.length > 0 && (
        <>
          <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 320, mb: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "background.paper" } }}>
                  <TableCell>Stock ID</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Purchase Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{r.stock_id}</TableCell>
                    <TableCell>{r.description || "—"}</TableCell>
                    <TableCell align="right">{r.quantity}</TableCell>
                    <TableCell align="right">{r.standard_cost ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={handleApply} disabled={!!progress}>
              Apply Adjustment
            </Button>
          </Stack>
        </>
      )}

      {results && (
        <Box sx={{ mt: 2 }}>
          <Typography color={results.errors.length ? "error" : "success.main"} fontWeight={700}>
            {results.success} item(s) adjusted{results.errors.length ? `, ${results.errors.length} batch(es) failed` : " successfully"}.
          </Typography>
          {results.errors.map((e, i) => <Typography key={i} variant="caption" color="error" display="block">{e}</Typography>)}
        </Box>
      )}
    </Box>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BulkStockAdjustmentPage() {
  const [tab, setTab] = useState<"manual" | "excel">("manual");
  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Bulk Stock Adjustment" />
        <Breadcrumb breadcrumbs={[
          { title: "Smart Supermarket", href: "/supermarket" },
          { title: "Inventory", href: "/supermarket/stock" },
          { title: "Bulk Stock Adjustment" },
        ]} />
      </Box>
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab value="manual" label="Manual Bulk" />
          <Tab value="excel" label="Excel Upload" />
        </Tabs>
        {tab === "manual" ? <ManualBulkTab /> : <ExcelBulkTab />}
      </Box>
    </FormPageLayout>
  );
}
