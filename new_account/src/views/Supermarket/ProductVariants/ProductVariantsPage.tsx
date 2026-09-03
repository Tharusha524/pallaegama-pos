import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete, IconButton,
  Tooltip, Card, CardContent, Checkbox, FormControlLabel, Badge,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import PrintIcon from "@mui/icons-material/Print";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import JsBarcode from "jsbarcode";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getItemVariants, createItemVariant, updateItemVariant, deleteItemVariant } from "../../../api/Pos/posAdvancedApi";
import { getItems } from "../../../api/Item/ItemApi";
import { getCompanies } from "../../../api/CompanySetup/CompanySetupApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";

const emptyForm = { stock_id: null as any, variant_name: "", sku: "", barcode: "", price_adjustment: "0" };

interface LabelLine {
  key: string;
  barcodeValue: string;
  productName: string;
  sku: string;
  price: number;
  qty: number;
}

/**
 * One page for everything barcode-related on a product/variant: create a
 * variant, see its barcode, and generate/print real scannable labels for it
 * (single or batch) — no separate "Barcode Labels" screen to navigate to.
 */
export default function ProductVariantsPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingVariant, setEditingVariant] = useState<any>(null);
  const [printOpen, setPrintOpen] = useState(false);

  // Print list (batch label generator)
  const [lines, setLines] = useState<LabelLine[]>([]);
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(true);

  const { data: variants, isLoading } = useQuery({ queryKey: ["item-variants"], queryFn: () => getItemVariants() });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: companies } = useQuery({ queryKey: ["company-setup-list"], queryFn: getCompanies });
  const company = companies?.[0];

  const createMutation = useMutation({
    mutationFn: createItemVariant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-variants"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateItemVariant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-variants"] });
      setOpen(false);
      setEditingVariant(null);
      setForm(emptyForm);
      notify.success("Variant updated");
    },
    onError: () => notify.error("Failed to update variant"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItemVariant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["item-variants"] }),
  });

  const openAddDialog = () => {
    setEditingVariant(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEditDialog = (v: any) => {
    setEditingVariant(v);
    setForm({
      stock_id: v.stock ?? { stock_id: v.stock_id, description: v.stock?.description },
      variant_name: v.variant_name,
      sku: v.sku ?? "",
      barcode: v.barcode ?? "",
      price_adjustment: String(v.price_adjustment ?? "0"),
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.stock_id || !form.variant_name) return;

    if (editingVariant) {
      updateMutation.mutate({
        id: editingVariant.id,
        data: {
          variant_name: form.variant_name,
          sku: form.sku || undefined,
          barcode: form.barcode || undefined,
          price_adjustment: Number(form.price_adjustment) || 0,
        },
      });
      return;
    }

    createMutation.mutate({
      stock_id: form.stock_id.stock_id,
      variant_name: form.variant_name,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      price_adjustment: Number(form.price_adjustment) || 0,
    });
  };

  const addVariantToPrintList = (v: any) => {
    if (!v.barcode) {
      notify.error("This variant has no barcode set — add one first");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `${v.barcode}-${Date.now()}`,
        barcodeValue: v.barcode,
        productName: `${v.stock?.description ?? v.stock_id} (${v.variant_name})`,
        sku: v.sku || v.stock_id,
        price: (Number(v.stock?.purchase_cost) || 0) + Number(v.price_adjustment),
        qty: 1,
      },
    ]);
    setPrintOpen(true);
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));
  const updateLineQty = (key: string, qty: number) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l)));

  const expandedLabels = lines.flatMap((line) => Array.from({ length: line.qty }, (_, i) => ({ ...line, key: `${line.key}-${i}` })));

  const handlePrint = () => window.print();

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }} className="pos-receipt-no-print">
        <Box>
          <PageTitle title="Product Variants & Barcode Labels" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Product Variants" }]} />
        </Box>
        <Stack direction="row" spacing={1}>
          <Badge badgeContent={expandedLabels.length} color="primary" invisible={expandedLabels.length === 0}>
            <Button variant="outlined" startIcon={<LocalOfferIcon />} onClick={() => setPrintOpen(true)}>Print Labels</Button>
          </Badge>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>Add Variant</Button>
        </Stack>
      </Box>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #variant-label-print-area, #variant-label-print-area * { visibility: visible; }
          #variant-label-print-area { position: absolute !important; top: 0; left: 0; }
          .pos-receipt-no-print { display: none !important; }
        }
      `}</style>

      {/*
        Always mounted (not inside the Print Labels dialog) so it isn't
        clipped by the dialog's scrollable content area or unmounted with
        it — window.print() needs this in the DOM regardless of whether the
        dialog is currently open. Pushed off-screen in normal view; the
        @media print rule above brings it back for the printed page.
      */}
      <Box id="variant-label-print-area" sx={{ position: "fixed", top: -10000, left: -10000, display: "flex", flexWrap: "wrap", gap: 1 }}>
        {expandedLabels.map((label) => (
          <Box
            key={label.key}
            sx={{ width: 220, p: 1, border: "1px dashed", borderColor: "divider", borderRadius: 1, textAlign: "center", fontFamily: "monospace" }}
          >
            {showBusinessName && company?.name && <Typography fontSize={9} fontWeight={700}>{company.name}</Typography>}
            <Typography fontSize={11} fontWeight={700} noWrap>{label.productName}</Typography>
            {showSku && <Typography fontSize={9} color="text.secondary">SKU: {label.sku}</Typography>}
            {showPrice && <Typography fontSize={12} fontWeight={800}>{formatCurrency(label.price)}</Typography>}
            <Box sx={{ mt: 0.5 }}>
              <svg
                ref={(el) => {
                  if (!el) return;
                  try {
                    JsBarcode(el, label.barcodeValue, { format: "CODE128", displayValue: false, height: 45, width: 1.6, margin: 10 });
                  } catch {
                    // Non-fatal — barcode just won't render if the value can't be encoded.
                  }
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2} className="pos-receipt-no-print">
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Product</TableCell><TableCell>Variant</TableCell><TableCell>SKU</TableCell>
                <TableCell>Barcode</TableCell><TableCell align="right">Price Adj.</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(variants ?? []).map((v: any) => (
                <TableRow key={v.id} hover>
                  <TableCell>{v.stock?.description}</TableCell>
                  <TableCell>{v.variant_name}</TableCell>
                  <TableCell>{v.sku ?? "—"}</TableCell>
                  <TableCell>{v.barcode ?? "—"}</TableCell>
                  <TableCell align="right">{formatCurrency(v.price_adjustment)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={v.barcode ? "Add to Print List" : "No barcode set for this variant"}>
                      <span>
                        <IconButton size="small" color="primary" disabled={!v.barcode} onClick={() => addVariantToPrintList(v)}>
                          <QrCode2Icon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Edit Variant">
                      <IconButton size="small" onClick={() => openEditDialog(v)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(v.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!variants || variants.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No product variants defined.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={printOpen} onClose={() => setPrintOpen(false)} maxWidth="md" fullWidth className="pos-receipt-no-print">
        <DialogTitle>Print Barcode Labels</DialogTitle>
        <DialogContent dividers>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Show on Label</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <FormControlLabel control={<Checkbox checked={showBusinessName} onChange={(e) => setShowBusinessName(e.target.checked)} />} label="Business Name" />
                <FormControlLabel control={<Checkbox checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />} label="Price" />
                <FormControlLabel control={<Checkbox checked={showSku} onChange={(e) => setShowSku(e.target.checked)} />} label="SKU" />
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>Print List</Typography>
                <Button size="small" variant="contained" startIcon={<PrintIcon />} disabled={lines.length === 0} onClick={handlePrint}>
                  Print {expandedLabels.length} Label{expandedLabels.length === 1 ? "" : "s"}
                </Button>
              </Stack>
              {lines.map((line) => (
                <Stack key={line.key} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>{line.productName}</Typography>
                  <TextField
                    type="number" size="small" value={line.qty} sx={{ width: 60 }}
                    onChange={(e) => updateLineQty(line.key, Number(e.target.value) || 1)}
                  />
                  <IconButton size="small" color="error" onClick={() => removeLine(line.key)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              {lines.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Click the barcode icon on any variant row to add it here.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/*
            Visual preview only — this copy is inside the dialog's scrollable
            area purely so the user can see what will print. The actual copy
            used by window.print() lives outside the dialog (see
            #variant-label-print-area at the top of the page) so it isn't
            clipped or unmounted when the dialog closes.
          */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {expandedLabels.map((label) => (
              <Box
                key={label.key}
                sx={{ width: 220, p: 1, border: "1px dashed", borderColor: "divider", borderRadius: 1, textAlign: "center", fontFamily: "monospace" }}
              >
                {showBusinessName && company?.name && <Typography fontSize={9} fontWeight={700}>{company.name}</Typography>}
                <Typography fontSize={11} fontWeight={700} noWrap>{label.productName}</Typography>
                {showSku && <Typography fontSize={9} color="text.secondary">SKU: {label.sku}</Typography>}
                {showPrice && <Typography fontSize={12} fontWeight={800}>{formatCurrency(label.price)}</Typography>}
                <Box sx={{ mt: 0.5 }}>
                  <svg
                    ref={(el) => {
                      if (!el) return;
                      try {
                        JsBarcode(el, label.barcodeValue, { format: "CODE128", displayValue: false, height: 45, width: 1.6, margin: 10 });
                      } catch {
                        // Non-fatal — barcode just won't render if the value can't be encoded.
                      }
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open} onClose={() => { setOpen(false); setEditingVariant(null); }} maxWidth="sm" fullWidth className="pos-receipt-no-print">
        <DialogTitle>{editingVariant ? "Edit Product Variant" : "Add Product Variant"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={items ?? []}
              getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              value={form.stock_id}
              onChange={(_, val) => setForm({ ...form, stock_id: val })}
              disabled={!!editingVariant}
              renderInput={(params) => <TextField {...params} label="Base Product" helperText={editingVariant ? "Base product can't be changed — delete and re-add to switch products" : undefined} />}
            />
            <TextField label="Variant Name" fullWidth value={form.variant_name} onChange={(e) => setForm({ ...form, variant_name: e.target.value })} placeholder="e.g. Red / Large" />
            <TextField label="SKU" fullWidth value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <TextField label="Barcode" fullWidth value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} helperText="Scan or type — used by POS Checkout's barcode scanner" />
            <TextField label="Price Adjustment" type="number" fullWidth value={form.price_adjustment} onChange={(e) => setForm({ ...form, price_adjustment: e.target.value })} helperText="Added to the base product's price" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setEditingVariant(null); }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.stock_id || !form.variant_name || createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
