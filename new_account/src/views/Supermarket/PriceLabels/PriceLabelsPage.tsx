import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Stack, TextField, Button, Autocomplete, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, Grid, FormControl, InputLabel, Select,
  MenuItem, Tabs, Tab, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Tooltip,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import HistoryIcon from "@mui/icons-material/History";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import QrCodeIcon from "@mui/icons-material/QrCode";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import * as XLSX from "xlsx";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getItems } from "../../../api/Item/ItemApi";
import { getSalesPricingByStockId } from "../../../api/SalesPricing/SalesPricingApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

const RETAIL_SALES_TYPE_ID = 3;
const LKR_CURRENCY_ID = 8;

type BarcodeType = "CODE128" | "EAN13" | "QR" | "internal";
type PriceType = "selling" | "mrp" | "discount" | "unit_per_kg" | "unit_per_100g" | "unit_per_litre";
type TemplateKey = "standard" | "shelf-strip" | "gondola-header" | "vegetable-fruit" | "small-sticker" | "custom";

type LabelLine = {
  product: any;
  qty: number;
  priceType: PriceType;
  barcodeType: BarcodeType;
  weightKg?: number;
};

const TEMPLATES: Record<TemplateKey, { label: string; width: number; height?: number; priceFontSize: number; showMrp: boolean; showBarcode: boolean }> = {
  "standard":        { label: "Standard Tag",                      width: 200,              priceFontSize: 15, showMrp: true,  showBarcode: true  },
  "shelf-strip":     { label: "Shelf Strip (long, low)",           width: 320, height: 60,  priceFontSize: 18, showMrp: true,  showBarcode: true  },
  "gondola-header":  { label: "Gondola Header (large)",            width: 260, height: 140, priceFontSize: 28, showMrp: false, showBarcode: false },
  "vegetable-fruit": { label: "Vegetable / Fruit (small, no barcode)", width: 140,          priceFontSize: 16, showMrp: false, showBarcode: false },
  "small-sticker":   { label: "Small Sticker",                     width: 110, height: 55,  priceFontSize: 12, showMrp: false, showBarcode: true  },
  "custom":          { label: "Custom Size",                        width: 180, height: 90,  priceFontSize: 14, showMrp: true,  showBarcode: true  },
};

const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  selling: "Selling Price", mrp: "MRP", discount: "Discount Price",
  unit_per_kg: "Per kg", unit_per_100g: "Per 100g", unit_per_litre: "Per litre",
};

const BARCODE_LABELS: Record<BarcodeType, string> = {
  CODE128: "Code 128", EAN13: "EAN-13", QR: "QR Code", internal: "Internal",
};

const PRINT_HISTORY_KEY = "price_label_history";

function loadHistory(): any[] {
  try { return JSON.parse(localStorage.getItem(PRINT_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(entries: any[]) {
  try { localStorage.setItem(PRINT_HISTORY_KEY, JSON.stringify(entries.slice(0, 200))); } catch {}
}

export default function PriceLabelsPage() {
  const { formatCurrency } = useHomeCurrency();
  const [tab, setTab] = useState(0);
  const [lines, setLines] = useState<LabelLine[]>([]);
  const [pendingProduct, setPendingProduct] = useState<any>(null);
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingBarcodeType, setPendingBarcodeType] = useState<BarcodeType>("CODE128");
  const [pendingPriceType, setPendingPriceType] = useState<PriceType>("selling");
  const [pendingWeightKg, setPendingWeightKg] = useState("");
  const [template, setTemplate] = useState<TemplateKey>("standard");
  const [customW, setCustomW] = useState("180");
  const [customH, setCustomH] = useState("90");
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [history, setHistory] = useState<any[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [priceChangeOpen, setPriceChangeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });

  const categories = Array.from(new Set((items ?? []).map((i: any) => i.category_id).filter(Boolean)));

  const filteredItems = (items ?? []).filter((i: any) => {
    const matchSearch = !searchFilter || i.description?.toLowerCase().includes(searchFilter.toLowerCase()) || i.stock_id?.toLowerCase().includes(searchFilter.toLowerCase()) || i.barcode?.includes(searchFilter);
    const matchCat = !categoryFilter || String(i.category_id) === String(categoryFilter);
    return matchSearch && matchCat;
  });

  const addLine = () => {
    if (!pendingProduct) return;
    const line: LabelLine = {
      product: pendingProduct,
      qty: Math.max(1, Number(pendingQty) || 1),
      barcodeType: pendingBarcodeType,
      priceType: pendingPriceType,
    };
    if (pendingWeightKg) line.weightKg = Number(pendingWeightKg);
    setLines((prev) => [...prev, line]);
    setPendingProduct(null); setPendingQty("1"); setPendingWeightKg("");
  };

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handlePrint = () => {
    const entry = {
      date: new Date().toLocaleString(),
      user: "Admin",
      lines: lines.map((l) => ({ product: l.product.description, qty: l.qty })),
    };
    const updated = [entry, ...history];
    setHistory(updated);
    saveHistory(updated);
    window.print();
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        const newLines: LabelLine[] = [];
        rows.forEach((row) => {
          const stockId = String(row["stock_id"] || row["Stock ID"] || row["Product ID"] || "").trim();
          const qty = Math.max(1, Number(row["qty"] || row["Qty"] || row["Labels"] || 1));
          const found = (items ?? []).find((i: any) => i.stock_id === stockId);
          if (found) newLines.push({ product: found, qty, barcodeType: pendingBarcodeType, priceType: pendingPriceType });
        });
        if (newLines.length) setLines((prev) => [...prev, ...newLines]);
      } catch {}
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const templateSpec = template === "custom"
    ? { ...TEMPLATES["custom"], width: Number(customW) || 180, height: Number(customH) || 90 }
    : TEMPLATES[template];

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <PageTitle title="Price Labels" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Price Labels" }]} />
          <Typography variant="caption" color="text.secondary">
            Print barcode labels — batch, weight-based, price change, Excel import.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Price Change Labels">
            <Button variant="outlined" startIcon={<PriceChangeIcon />} onClick={() => setPriceChangeOpen(true)}>Price Changes</Button>
          </Tooltip>
          <Tooltip title="Reprint History">
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setHistoryOpen(true)}>History</Button>
          </Tooltip>
        </Stack>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Build Labels" />
        <Tab label="Preview" />
      </Tabs>

      {tab === 0 && (
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }} className="pos-receipt-no-print">
          <CardContent>
            {/* Template + Options */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Label Template</InputLabel>
                <Select value={template} label="Label Template" onChange={(e) => setTemplate(e.target.value as TemplateKey)}>
                  {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
                    <MenuItem key={k} value={k}>{TEMPLATES[k].label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {template === "custom" && (
                <>
                  <TextField label="Width (px)" size="small" sx={{ width: 110 }} value={customW} onChange={(e) => setCustomW(e.target.value)} type="number" />
                  <TextField label="Height (px)" size="small" sx={{ width: 110 }} value={customH} onChange={(e) => setCustomH(e.target.value)} type="number" />
                </>
              )}
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Barcode Type</InputLabel>
                <Select value={pendingBarcodeType} label="Barcode Type" onChange={(e) => setPendingBarcodeType(e.target.value as BarcodeType)}>
                  {(Object.keys(BARCODE_LABELS) as BarcodeType[]).map((k) => (
                    <MenuItem key={k} value={k}>{BARCODE_LABELS[k]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Price Type</InputLabel>
                <Select value={pendingPriceType} label="Price Type" onChange={(e) => setPendingPriceType(e.target.value as PriceType)}>
                  {(Object.keys(PRICE_TYPE_LABELS) as PriceType[]).map((k) => (
                    <MenuItem key={k} value={k}>{PRICE_TYPE_LABELS[k]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {/* Search + Filter */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
              <TextField size="small" placeholder="Search product / barcode..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Category</InputLabel>
                <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {categories.map((c: any) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            {/* Add product row */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
              <Autocomplete
                sx={{ flex: 1, minWidth: 240 }}
                options={filteredItems}
                getOptionLabel={(i: any) => `${i.description ?? ""} ${i.stock_id ? `(${i.stock_id})` : ""}`}
                value={pendingProduct}
                onChange={(_, v) => setPendingProduct(v)}
                renderInput={(p) => <TextField {...p} label="Product" size="small" />}
              />
              {["unit_per_kg", "unit_per_100g", "unit_per_litre"].includes(pendingPriceType) && (
                <TextField label="Weight (kg)" type="number" size="small" sx={{ width: 120 }} value={pendingWeightKg} onChange={(e) => setPendingWeightKg(e.target.value)} inputProps={{ step: 0.001 }} />
              )}
              <TextField label="Labels" type="number" size="small" sx={{ width: 90 }} value={pendingQty} onChange={(e) => setPendingQty(e.target.value)} />
              <Button variant="outlined" startIcon={<AddIcon />} disabled={!pendingProduct} onClick={addLine}>Add</Button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImportExcel} />
              <Tooltip title="Import from Excel/CSV (columns: stock_id, qty)">
                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>Import</Button>
              </Tooltip>
            </Stack>

            {lines.length > 0 && (
              <>
                <Table size="small" sx={{ mt: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Barcode</TableCell>
                      <TableCell>Price Type</TableCell>
                      <TableCell>Weight</TableCell>
                      <TableCell align="right">Labels</TableCell>
                      <TableCell align="center">Remove</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.product.description}</TableCell>
                        <TableCell><Chip label={BARCODE_LABELS[l.barcodeType]} size="small" /></TableCell>
                        <TableCell><Chip label={PRICE_TYPE_LABELS[l.priceType]} size="small" color="primary" /></TableCell>
                        <TableCell>{l.weightKg ? `${l.weightKg} kg` : "—"}</TableCell>
                        <TableCell align="right">{l.qty}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => removeLine(i)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button variant="contained" startIcon={<PrintIcon />} sx={{ mt: 2 }} onClick={handlePrint} disabled={lines.length === 0}>
                  Print Labels
                </Button>
              </>
            )}
            {lines.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>Add products above or import from Excel to build your label batch.</Alert>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 1 && lines.length === 0 && (
        <Alert severity="info">Add products in the Build Labels tab first.</Alert>
      )}

      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #price-label-print-area, #price-label-print-area * { visibility: visible; }
          #price-label-print-area { position: absolute; top: 0; left: 0; }
          .pos-receipt-no-print { display: none !important; }
        }
      `}</style>

      {/* Label Preview + Print Area */}
      {lines.length > 0 && (
        <Box id="price-label-print-area">
          <Grid container spacing={1}>
            {lines.flatMap((l, li) =>
              Array.from({ length: l.qty }).map((_, copy) => (
                <Grid item key={`${li}-${copy}`}>
                  <PriceLabel
                    product={l.product}
                    formatCurrency={formatCurrency}
                    templateSpec={templateSpec}
                    barcodeType={l.barcodeType}
                    priceType={l.priceType}
                    weightKg={l.weightKg}
                  />
                </Grid>
              ))
            )}
          </Grid>
        </Box>
      )}

      {/* Reprint History Dialog */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Print History</DialogTitle>
        <DialogContent>
          {history.length === 0 ? (
            <Typography color="text.secondary">No print history yet.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell><TableCell>Products</TableCell><TableCell>Total Labels</TableCell><TableCell>User</TableCell><TableCell>Reprint</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>{h.date}</TableCell>
                    <TableCell>{h.lines.map((l: any) => l.product).join(", ")}</TableCell>
                    <TableCell>{h.lines.reduce((s: number, l: any) => s + l.qty, 0)}</TableCell>
                    <TableCell>{h.user}</TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<PrintIcon />} onClick={() => {
                        // Re-add those products to queue from history
                        const toAdd: LabelLine[] = h.lines.flatMap((hl: any) => {
                          const found = (items ?? []).find((it: any) => it.description === hl.product);
                          return found ? [{ product: found, qty: hl.qty, barcodeType: "CODE128" as BarcodeType, priceType: "selling" as PriceType }] : [];
                        });
                        setLines(toAdd);
                        setHistoryOpen(false);
                        setTab(0);
                      }}>Reprint</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setHistoryOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Price Change Labels Dialog */}
      <PriceChangeDialog
        open={priceChangeOpen}
        onClose={() => setPriceChangeOpen(false)}
        items={items ?? []}
        onAddToQueue={(newLines) => { setLines((prev) => [...prev, ...newLines]); setPriceChangeOpen(false); setTab(0); }}
        barcodeType={pendingBarcodeType}
        priceType={pendingPriceType}
        formatCurrency={formatCurrency}
      />
    </FormPageLayout>
  );
}

// ── PriceLabel component ──────────────────────────────────────────────────────

function PriceLabel({ product, formatCurrency, templateSpec, barcodeType, priceType, weightKg }: {
  product: any; formatCurrency: (v: number) => string;
  templateSpec: any; barcodeType: BarcodeType; priceType: PriceType; weightKg?: number;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const { data: pricingRows } = useQuery({
    queryKey: ["sales-pricing", product.stock_id],
    queryFn: () => getSalesPricingByStockId(product.stock_id),
  });

  const currentPricing = (pricingRows ?? []).find(
    (p: any) => p.sales_type_id === RETAIL_SALES_TYPE_ID && p.currency_id === LKR_CURRENCY_ID
  );
  const sellingPrice = Number(currentPricing?.price) || 0;
  const mrpPrice = Number(product.mrp_price) || 0;
  const discountPrice = currentPricing?.special_price ? Number(currentPricing.special_price) : sellingPrice;

  let displayPrice = sellingPrice;
  let priceLabel = "";
  if (priceType === "mrp") { displayPrice = mrpPrice; priceLabel = "MRP"; }
  else if (priceType === "discount") { displayPrice = discountPrice; priceLabel = "OFFER"; }
  else if (priceType === "unit_per_kg" && weightKg) { displayPrice = sellingPrice * weightKg; priceLabel = `${weightKg} kg × ${formatCurrency(sellingPrice)}`; }
  else if (priceType === "unit_per_100g" && weightKg) { displayPrice = sellingPrice * weightKg / 10; priceLabel = `${weightKg} kg`; }
  else if (priceType === "unit_per_litre" && weightKg) { displayPrice = sellingPrice * weightKg; priceLabel = `${weightKg} L × ${formatCurrency(sellingPrice)}`; }

  const rawBarcode = barcodeType === "internal"
    ? product.stock_id
    : (product.barcode || product.stock_id);

  useEffect(() => {
    if (barcodeType === "QR") {
      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, String(rawBarcode), { width: 60, margin: 1 }).catch(() => {});
      }
    } else if (templateSpec.showBarcode && barcodeRef.current && rawBarcode) {
      try {
        const fmt = barcodeType === "EAN13" ? "EAN13" : "CODE128";
        JsBarcode(barcodeRef.current, String(rawBarcode), {
          format: fmt, displayValue: false, height: 35, width: 1, margin: 4,
        });
      } catch {
        // fall back silently
      }
    }
  }, [rawBarcode, barcodeType, templateSpec.showBarcode]);

  return (
    <Box sx={{
      width: templateSpec.width, height: templateSpec.height, p: 1,
      border: "1px dashed", borderColor: "divider", borderRadius: 1,
      textAlign: "center", fontFamily: "monospace",
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      <Typography fontSize={12} fontWeight={700} noWrap>{product.description}</Typography>
      {templateSpec.showMrp && mrpPrice > 0 && priceType !== "mrp" && (
        <Typography fontSize={9} color="text.secondary" sx={{ textDecoration: "line-through" }}>MRP: {formatCurrency(mrpPrice)}</Typography>
      )}
      {priceLabel && <Typography fontSize={9} color="primary.main">{priceLabel}</Typography>}
      <Typography fontSize={templateSpec.priceFontSize} fontWeight={800}>{formatCurrency(displayPrice)}</Typography>
      {templateSpec.showBarcode && (
        <>
          {barcodeType === "QR" ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
              <canvas ref={qrCanvasRef} style={{ width: 60, height: 60 }} />
            </Box>
          ) : (
            <Box sx={{ mt: 0.5 }}>
              <svg ref={barcodeRef} style={{ maxWidth: "100%", height: "auto" }} />
            </Box>
          )}
          <Typography fontSize={9} color="text.secondary">{rawBarcode}</Typography>
        </>
      )}
    </Box>
  );
}

// ── Price Change Dialog ───────────────────────────────────────────────────────

function PriceChangeDialog({ open, onClose, items, onAddToQueue, barcodeType, priceType, formatCurrency }: {
  open: boolean; onClose: () => void; items: any[];
  onAddToQueue: (lines: LabelLine[]) => void;
  barcodeType: BarcodeType; priceType: PriceType;
  formatCurrency: (v: number) => string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lookbackDays, setLookbackDays] = useState("7");

  // Detect products whose price was updated within lookback period via updated_at on pricing rows
  const { data: allPricing } = useQuery({
    queryKey: ["all-pricing-recent", lookbackDays],
    queryFn: async () => {
      // Fetch pricing for all items and filter by updated_at
      return [];  // Placeholder — in real use this would call a backend endpoint
    },
    enabled: open,
  });

  // For now, show items that have a barcode (most likely actual selling items)
  const candidateItems = items.filter((i: any) => i.barcode || i.stock_id).slice(0, 50);

  const toggle = (stockId: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(stockId) ? n.delete(stockId) : n.add(stockId);
      return n;
    });
  };

  const handleAdd = () => {
    const lines: LabelLine[] = candidateItems
      .filter((i: any) => selected.has(i.stock_id))
      .map((i: any) => ({ product: i, qty: 1, barcodeType, priceType }));
    onAddToQueue(lines);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Price Change Labels</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Select products whose price recently changed to add them to the print queue.
        </Alert>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <TextField label="Lookback (days)" size="small" type="number" value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value)} sx={{ width: 140 }} />
          <Button size="small" onClick={() => setSelected(new Set(candidateItems.map((i: any) => i.stock_id)))}>Select All</Button>
          <Button size="small" onClick={() => setSelected(new Set())}>Clear</Button>
        </Stack>
        <Table size="small">
          <TableHead><TableRow><TableCell padding="checkbox">✓</TableCell><TableCell>Product</TableCell><TableCell>Stock ID</TableCell></TableRow></TableHead>
          <TableBody>
            {candidateItems.map((i: any) => (
              <TableRow key={i.stock_id} hover sx={{ cursor: "pointer" }} onClick={() => toggle(i.stock_id)}>
                <TableCell padding="checkbox">
                  <input type="checkbox" checked={selected.has(i.stock_id)} onChange={() => toggle(i.stock_id)} />
                </TableCell>
                <TableCell>{i.description}</TableCell>
                <TableCell>{i.stock_id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={selected.size === 0} onClick={handleAdd}>
          Add {selected.size} to Queue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
