import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Stack, TextField, Autocomplete, Typography, Table,
  TableHead, TableRow, TableCell, TableBody, IconButton, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import InventoryIcon from "@mui/icons-material/Inventory";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getItems, createItem } from "../../../api/Item/ItemApi";
import { getSuppliers, createSupplier } from "../../../api/Supplier/SupplierApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { postDirectGrn } from "../../../api/Purchases/PurchasesApi";
import { getItemCategories, createItemCategory } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getChartMasters } from "../../../api/GLAccounts/ChartMasterApi";
import { getItemTaxTypes } from "../../../api/ItemTaxType/ItemTaxTypeApi";
import { getItemUnits } from "../../../api/ItemUnit/ItemUnitApi";
import { getItemTypes } from "../../../api/ItemType/ItemType";
import { lookupBarcode } from "../../../api/Pos/posApi";
import { createItemCode } from "../../../api/ItemCodes/ItemCodesApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";

interface ReceiveLine {
  key: string;
  item: any;
  quantity: string;
  unit_price: string;
}

/**
 * A short-form front end for receiving daily stock deliveries — supermarket
 * staff don't need the full multi-screen Purchase Order → GRN → Invoice
 * workflow just to log what physically arrived. Under the hood this calls
 * the exact same genuine backend used by the full Purchase module
 * (GrnReceiptService::directGrn — creates the PO + GRN in one real,
 * accounted transaction: stock quantities update and GL posts normally).
 * The supplier invoice itself is still entered later through Purchase →
 * Transactions when the actual invoice document arrives, same as before —
 * this page only speeds up recording what was received today.
 */
export default function QuickStockReceivePage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [supplier, setSupplier] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);

  // Row-builder fields
  const [pickedItem, setPickedItem] = useState<any>(null);
  const [pickedQty, setPickedQty] = useState("1");
  const [pickedPrice, setPickedPrice] = useState("0");

  // Barcode scan — same lookup POS Checkout uses (item_variants.barcode,
  // item_codes/foreign codes, then stock_id), so staff can scan each
  // product straight off the delivery instead of searching by name.
  const [scanCode, setScanCode] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const item = await lookupBarcode(trimmed);
      setPickedItem(item);
      setPickedPrice(String(item.purchase_cost ?? 0));
      notify.success(`Scanned: ${item.description}`);
    } catch (err: any) {
      notify.error(err?.response?.data?.message || `No product found for code "${trimmed}"`);
    }
  };

  const handleScanKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = scanCode;
    setScanCode("");
    await handleScan(code);
    scanInputRef.current?.focus();
  };

  const { data: suppliers } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations-all"], queryFn: getInventoryLocations });

  // "+ New Supplier" shortcut — a supplier's payable/purchase GL accounts
  // are optional and unused by GL posting (Accounts Payable posts to one
  // company-wide control account from System Preferences, not a per-supplier
  // one), so leaving them blank here has no effect on accounting — same as
  // an existing supplier with those fields empty.
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierContact, setNewSupplierContact] = useState("");

  const createSupplierMutation = useMutation({
    mutationFn: () => createSupplier({
      supp_name: newSupplierName.trim(),
      supp_short_name: newSupplierName.trim().slice(0, 30),
      contact: newSupplierContact.trim(),
    }),
    onSuccess: (created) => {
      notify.success("Supplier created");
      queryClient.invalidateQueries({ queryKey: ["suppliers-all"] });
      setSupplier(created);
      setNewSupplierOpen(false);
      setNewSupplierName("");
      setNewSupplierContact("");
    },
    onError: () => notify.error("Failed to create supplier"),
  });

  // "+ New Product" shortcut — creates a real stock_master item through the
  // same genuine create-item logic the full Item Maintenance screen uses
  // (GL accounts always auto-resolved from the chosen category, never
  // entered by hand here), so a brand-new product can be received without
  // leaving this page.
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState<any>(null);
  const [newProductCost, setNewProductCost] = useState("0");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const newProductBarcodeRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories() });
  const { data: chartMasters } = useQuery({ queryKey: ["chart-masters"], queryFn: getChartMasters });
  const { data: taxTypes } = useQuery({ queryKey: ["item-tax-types"], queryFn: getItemTaxTypes });
  const { data: units } = useQuery({ queryKey: ["item-units"], queryFn: getItemUnits });
  const { data: itemTypes } = useQuery({ queryKey: ["item-types"], queryFn: getItemTypes });

  // "+ New Category" shortcut, nested inside "+ New Product" — same idea:
  // create the category with the standard default accounts (the same ones
  // Add Item Categories itself defaults new categories to), so staff never
  // has to see or pick a GL account code. Refine the mapping later in
  // Item Categories → Edit if distinct per-category accounts are wanted.
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const taxType = (taxTypes ?? [])[0];
      const unit = (units ?? []).find((u: any) => /each/i.test(u.name ?? "")) ?? (units ?? [])[0];
      const purchasedType = (itemTypes ?? []).find((t: any) => /purchased/i.test(t.name ?? "")) ?? (itemTypes ?? [])[0];

      return createItemCategory(
        {
          description: newCategoryName.trim(),
          dflt_tax_type: taxType?.id,
          dflt_units: unit?.id,
          dflt_mb_flag: purchasedType?.id,
        },
        chartMasters ?? []
      );
    },
    onSuccess: (created) => {
      notify.success("Category created");
      queryClient.invalidateQueries({ queryKey: ["item-categories"] });
      setNewProductCategory(created);
      setNewCategoryOpen(false);
      setNewCategoryName("");
    },
    onError: () => notify.error("Failed to create category"),
  });

  const createProductMutation = useMutation({
    mutationFn: async () => {
      const taxType = (taxTypes ?? [])[0];
      const unit = (units ?? []).find((u: any) => /each/i.test(u.name ?? "")) ?? (units ?? [])[0];
      const purchasedType = (itemTypes ?? []).find((t: any) => /purchased/i.test(t.name ?? "")) ?? (itemTypes ?? [])[0];
      const stockId = `SM${Date.now()}`;

      const created = await createItem(
        {
          stock_id: stockId,
          description: newProductName.trim(),
          long_description: newProductName.trim(),
          category_id: newProductCategory?.category_id,
          tax_type_id: taxType?.id,
          units: unit?.id,
          mb_flag: purchasedType?.id,
          purchase_cost: Number(newProductCost) || 0,
          material_cost: Number(newProductCost) || 0,
        },
        { chartMasters: chartMasters ?? [], category: newProductCategory }
      );

      // The scanned manufacturer barcode is stored as a Foreign Item Code —
      // just an ID linking that barcode number to this product, no GL/tax/
      // cost fields at all, so it has no effect on accounting whatsoever.
      const barcode = newProductBarcode.trim();
      if (barcode) {
        try {
          await createItemCode({
            item_code: barcode,
            stock_id: stockId,
            description: newProductName.trim(),
            category_id: newProductCategory?.category_id,
            quantity: 1,
            is_foreign: true,
          });
        } catch {
          // Non-fatal — the product itself was created successfully; the
          // barcode link can still be added later from Item Codes if this fails
          // (e.g. that exact barcode is already linked to another product).
          notify.error("Product created, but the barcode could not be linked — add it later from Item Codes");
        }
      }

      return created;
    },
    onSuccess: (created) => {
      notify.success("Product created");
      queryClient.invalidateQueries({ queryKey: ["items-all"] });
      setPickedItem(created);
      // Carry the cost just entered straight into the row builder — the
      // whole point of setting it while creating the product is not having
      // to re-type it a second time back on the main page.
      setPickedPrice(String(created.purchase_cost ?? 0));
      setNewProductOpen(false);
      setNewProductName("");
      setNewProductCategory(null);
      setNewProductCost("0");
      setNewProductBarcode("");
    },
    onError: () => notify.error("Failed to create product — check the fields and try again"),
  });

  const receiveMutation = useMutation({
    mutationFn: postDirectGrn,
    onSuccess: (result: any) => {
      notify.success(`Stock received — GRN ${result?.reference ?? ""} posted`);
      setLines([]);
      setReference("");
    },
    onError: (err: any) => {
      notify.error(err?.response?.data?.message || "Failed to receive stock");
    },
  });

  const addLine = () => {
    if (!pickedItem) return;
    setLines((prev) => [
      ...prev,
      {
        key: `${pickedItem.stock_id}-${Date.now()}`,
        item: pickedItem,
        quantity: pickedQty,
        unit_price: pickedPrice,
      },
    ]);
    setPickedItem(null);
    setPickedQty("1");
    setPickedPrice("0");
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  const canSubmit = !!supplier && !!location && lines.length > 0 && !receiveMutation.isPending;

  const handleSubmit = () => {
    if (!supplier || !location) return;
    receiveMutation.mutate({
      supplier_id: supplier.supplier_id,
      reference: reference || undefined,
      delivery_date: deliveryDate,
      into_stock_location: location.loc_code,
      total,
      lines: lines.map((l) => ({
        item_code: l.item.stock_id,
        description: l.item.description,
        quantity: Number(l.quantity) || 0,
        unit_price: Number(l.unit_price) || 0,
      })),
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Quick Stock Receive" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Quick Stock Receive" }]} />
        <Typography variant="caption" color="text.secondary">
          Fast entry for stock that just arrived — posts the same real Purchase Order + GRN as the full Purchase module (stock and accounts update normally). Enter the supplier invoice later through Purchase when it arrives.
        </Typography>
      </Box>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Autocomplete
                sx={{ flex: 1 }}
                options={suppliers ?? []}
                getOptionLabel={(s: any) => s.supp_name ?? ""}
                value={supplier}
                onChange={(_, val) => setSupplier(val)}
                renderInput={(params) => <TextField {...params} label="Supplier" size="small" />}
              />
              <Button size="small" onClick={() => setNewSupplierOpen(true)} sx={{ whiteSpace: "nowrap" }}>
                + New Supplier
              </Button>
              <Autocomplete
                sx={{ flex: 1 }}
                options={locations ?? []}
                getOptionLabel={(l: any) => l.location_name ?? l.loc_code ?? ""}
                value={location}
                onChange={(_, val) => setLocation(val)}
                renderInput={(params) => <TextField {...params} label="Receiving Location" size="small" />}
              />
              <TextField
                label="Delivery Date" type="date" size="small" sx={{ flex: 1 }}
                value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Reference / Delivery Note # (optional)" size="small" sx={{ flex: 1 }}
                value={reference} onChange={(e) => setReference(e.target.value)}
              />
            </Stack>

            <Divider />

            <Typography variant="subtitle2" fontWeight={700}>Scan Barcode</Typography>
            <TextField
              inputRef={scanInputRef}
              placeholder="Scan a product's barcode — cursor here, scan, it fills in below"
              size="small"
              autoFocus
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={handleScanKeyDown}
              InputProps={{ startAdornment: <QrCodeScannerIcon sx={{ mr: 1, color: "text.secondary" }} /> }}
            />

            <Divider />

            <Typography variant="subtitle2" fontWeight={700}>Add Item</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
              <Autocomplete
                sx={{ flex: 2 }}
                options={items ?? []}
                getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
                value={pickedItem}
                onChange={(_, val) => setPickedItem(val)}
                renderInput={(params) => <TextField {...params} label="Product" size="small" />}
              />
              <Button size="small" onClick={() => setNewProductOpen(true)} sx={{ whiteSpace: "nowrap" }}>
                + New Product
              </Button>
              <TextField
                label="Quantity" type="number" size="small" sx={{ width: 120 }}
                value={pickedQty} onChange={(e) => setPickedQty(e.target.value)}
              />
              <TextField
                label="Cost / unit" type="number" size="small" sx={{ width: 140 }}
                value={pickedPrice} onChange={(e) => setPickedPrice(e.target.value)}
              />
              <Button variant="outlined" startIcon={<AddIcon />} disabled={!pickedItem} onClick={addLine}>
                Add Row
              </Button>
            </Stack>

            {lines.length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Cost/unit</TableCell>
                    <TableCell align="right">Line Total</TableCell>
                    <TableCell align="center">Remove</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell>{l.item.description}</TableCell>
                      <TableCell align="right">{l.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(Number(l.unit_price) || 0)}</TableCell>
                      <TableCell align="right">{formatCurrency((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => removeLine(l.key)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Total: {formatCurrency(total)}</Typography>
              <Button
                variant="contained" size="large" startIcon={<InventoryIcon />}
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {receiveMutation.isPending ? "Receiving..." : "Receive Stock"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        maxWidth="xs"
        fullWidth
        TransitionProps={{
          // autoFocus alone can race with the Dialog's own focus management
          // (especially on a second/third open) and land focus on the
          // dialog container instead of the field — explicitly focus once
          // the open transition has actually finished, so a barcode scanner
          // reliably has somewhere to type into every time this opens.
          onEntered: () => newProductBarcodeRef.current?.focus(),
        }}
      >
        <DialogTitle>New Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              inputRef={newProductBarcodeRef}
              label="Barcode — scan it here" fullWidth
              placeholder="Scan the product's barcode, or type it"
              value={newProductBarcode} onChange={(e) => setNewProductBarcode(e.target.value)}
              InputProps={{ startAdornment: <QrCodeScannerIcon sx={{ mr: 1, color: "text.secondary" }} /> }}
              helperText="Optional — links this exact barcode to the product so it scans correctly at checkout"
            />
            <TextField
              label="Product Name" fullWidth
              value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Autocomplete
                sx={{ flex: 1 }}
                options={categories ?? []}
                getOptionLabel={(c: any) => c.description ?? ""}
                value={newProductCategory}
                onChange={(_, val) => setNewProductCategory(val)}
                renderInput={(params) => <TextField {...params} label="Category" />}
              />
              <Button size="small" onClick={() => setNewCategoryOpen(true)} sx={{ whiteSpace: "nowrap" }}>
                + New
              </Button>
            </Stack>
            <TextField
              label="Cost / unit" type="number" fullWidth
              value={newProductCost} onChange={(e) => setNewProductCost(e.target.value)}
              helperText="Sales/inventory accounts are set automatically from the category — nothing to fill in here"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewProductOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!newProductName.trim() || !newProductCategory || createProductMutation.isPending}
            onClick={() => createProductMutation.mutate()}
          >
            {createProductMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newCategoryOpen} onClose={() => setNewCategoryOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Category</DialogTitle>
        <DialogContent>
          <TextField
            label="Category Name" fullWidth autoFocus sx={{ mt: 1 }}
            value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
            helperText="Uses the standard default accounts — adjust them later in Item Categories if needed"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCategoryOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
            onClick={() => createCategoryMutation.mutate()}
          >
            {createCategoryMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newSupplierOpen} onClose={() => setNewSupplierOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Supplier</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Supplier Name" fullWidth autoFocus
              value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
            />
            <TextField
              label="Contact / Mobile (optional)" fullWidth
              value={newSupplierContact} onChange={(e) => setNewSupplierContact(e.target.value)}
              helperText="Payment terms, credit limit, and accounts can be filled in later from Purchase → Maintenance → Suppliers"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewSupplierOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!newSupplierName.trim() || createSupplierMutation.isPending}
            onClick={() => createSupplierMutation.mutate()}
          >
            {createSupplierMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
