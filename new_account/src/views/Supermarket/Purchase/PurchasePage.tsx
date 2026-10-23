import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Tabs, Tab, Card, CardContent, Stack, TextField, Autocomplete, Button, Table,
  TableHead, TableRow, TableCell, TableBody, IconButton, Typography, Divider,
  Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import InventoryIcon from "@mui/icons-material/Inventory";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PaymentIcon from "@mui/icons-material/Payment";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getItems, createItem } from "../../../api/Item/ItemApi";
import { getSuppliers } from "../../../api/Supplier/SupplierApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { getBankAccounts } from "../../../api/BankAccount/BankAccountApi";
import { getItemCategories } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getSubcategories } from "../../../api/Subcategories/SubcategoriesApi";
import { getBrands } from "../../../api/Brands/BrandsApi";
import { getChartMasters } from "../../../api/GLAccounts/ChartMasterApi";
import { getItemTaxTypes } from "../../../api/ItemTaxType/ItemTaxTypeApi";
import { getItemUnits } from "../../../api/ItemUnit/ItemUnitApi";
import { getItemTypes } from "../../../api/ItemType/ItemType";
import {
  postPurchOrderWithDetails, getNextPurchOrderNo, getPurchOrders, getPurchOrderDetails,
} from "../../../api/PurchOrders/PurchOrderApi";
import {
  postGrnReceive, postSupplierInvoiceFromGrn, getOpenGrnItems, postSupplierPayment,
  getSupplierPaymentAllocatable,
} from "../../../api/Purchases/PurchasesApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";
import { BatchPriceCells, BatchPriceHeadCells, batchPricePayload, useMrpMap, useRetailPriceMap, type BatchPriceInput } from "../../../components/BatchPriceFields";

/**
 * The proper 3-step supermarket purchasing flow — kept as three short tabs
 * on one page rather than three separate heavy screens. Every step calls
 * the exact same genuine, already-existing backend services the full
 * Purchase module uses (PurchOrderPostingService, GrnReceiptService,
 * SupplierInvoiceService) — nothing new in accounting, just a simpler
 * front end over it:
 *
 *   1. Purchase Order  — what you agreed to buy, nothing received yet.
 *   2. Goods Receipt    — what actually arrived, against that order.
 *   3. Supplier Invoice — the supplier's bill for what was received,
 *                          which is what actually creates the payable.
 */
export default function PurchasePage() {
  const [tab, setTab] = useState(0);

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Purchase" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Purchase" }]} />
        <Typography variant="caption" color="text.secondary">
          The full genuine flow: order it, receive it, then invoice it — each step posts through the same real accounting as the full Purchase module.
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="1. Purchase Order" />
        <Tab icon={<InventoryIcon fontSize="small" />} iconPosition="start" label="2. Goods Receipt" />
        <Tab icon={<ReceiptIcon fontSize="small" />} iconPosition="start" label="3. Supplier Invoice" />
        <Tab icon={<PaymentIcon fontSize="small" />} iconPosition="start" label="4. Pay Supplier" />
      </Tabs>

      {tab === 0 && <CreatePurchaseOrderTab />}
      {tab === 1 && <GoodsReceiptTab />}
      {tab === 2 && <SupplierInvoiceTab />}
      {tab === 3 && <PaySupplierTab />}
    </FormPageLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Purchase Order — what you agreed to buy from the supplier.
// ---------------------------------------------------------------------------
interface PoLine { key: string; item: any; quantity: string; unit_price: string }

function CreatePurchaseOrderTab() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [supplier, setSupplier] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<PoLine[]>([]);

  const [pickedItem, setPickedItem] = useState<any>(null);
  const [pickedQty, setPickedQty] = useState("1");
  const [pickedPrice, setPickedPrice] = useState("0");

  const { data: suppliers } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations-all"], queryFn: getInventoryLocations });

  // "+ New Product" — for a genuinely new item the supplier is delivering
  // for the first time. Creates a real stock_master record through the
  // same genuine create-item logic Item Maintenance itself uses (GL
  // accounts always auto-resolved from the chosen Category, never shown
  // or entered here). Category is required; Subcategory and Brand are
  // optional organizational labels only — neither affects accounting.
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState<any>(null);
  const [newProductSubcategory, setNewProductSubcategory] = useState<any>(null);
  const [newProductBrand, setNewProductBrand] = useState<any>(null);
  const [newProductCost, setNewProductCost] = useState("0");

  const { data: categories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories() });
  const { data: brands } = useQuery({ queryKey: ["brands-all"], queryFn: getBrands });
  const brandsForCategory = (brands ?? []).filter((b: any) => b.category_id === newProductCategory?.category_id);
  const { data: subcategories } = useQuery({
    queryKey: ["subcategories-for-brand", newProductBrand?.id],
    queryFn: () => getSubcategories(newProductBrand.id),
    enabled: !!newProductBrand,
  });
  const { data: chartMasters } = useQuery({ queryKey: ["chart-masters"], queryFn: getChartMasters });
  const { data: taxTypes } = useQuery({ queryKey: ["item-tax-types"], queryFn: getItemTaxTypes });
  const { data: units } = useQuery({ queryKey: ["item-units"], queryFn: getItemUnits });
  const { data: itemTypes } = useQuery({ queryKey: ["item-types"], queryFn: getItemTypes });

  const createProductMutation = useMutation({
    mutationFn: () => {
      const taxType = (taxTypes ?? [])[0];
      const unit = (units ?? []).find((u: any) => /each/i.test(u.name ?? "")) ?? (units ?? [])[0];
      const purchasedType = (itemTypes ?? []).find((t: any) => /purchased/i.test(t.name ?? "")) ?? (itemTypes ?? [])[0];
      const stockId = `SM${Date.now()}`;

      return createItem(
        {
          stock_id: stockId,
          description: newProductName.trim(),
          long_description: newProductName.trim(),
          category_id: newProductCategory?.category_id,
          brand_id: newProductBrand?.id,
          subcategory_id: newProductSubcategory?.id,
          tax_type_id: taxType?.id,
          units: unit?.id,
          mb_flag: purchasedType?.id,
          purchase_cost: Number(newProductCost) || 0,
          material_cost: Number(newProductCost) || 0,
        },
        { chartMasters: chartMasters ?? [], category: newProductCategory }
      );
    },
    onSuccess: (created) => {
      notify.success("Product created");
      queryClient.invalidateQueries({ queryKey: ["items-all"] });
      setPickedItem(created);
      setNewProductOpen(false);
      setNewProductName("");
      setNewProductCategory(null);
      setNewProductSubcategory(null);
      setNewProductBrand(null);
      setNewProductCost("0");
    },
    onError: () => notify.error("Failed to create product — check the fields and try again"),
  });

  const addLine = () => {
    if (!pickedItem) return;
    setLines((prev) => [
      ...prev,
      { key: `${pickedItem.stock_id}-${Date.now()}`, item: pickedItem, quantity: pickedQty, unit_price: pickedPrice },
    ]);
    setPickedItem(null);
    setPickedQty("1");
    setPickedPrice("0");
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const orderNo = await getNextPurchOrderNo();
      return postPurchOrderWithDetails({
        header: {
          order_no: orderNo,
          supplier_id: supplier.supplier_id,
          comments: null,
          ord_date: new Date().toISOString().slice(0, 10),
          reference: reference || `PO-${orderNo}`,
          requisition_no: null,
          into_stock_location: location.loc_code,
          delivery_address: "",
          total,
          prep_amount: 0,
          alloc: 0,
          tax_included: false,
          cost_center_id: 0,
        },
        lines: lines.map((l) => ({
          item_code: l.item.stock_id,
          description: l.item.description,
          delivery_date: expectedDeliveryDate,
          qty_invoiced: 0,
          unit_price: Number(l.unit_price) || 0,
          act_price: Number(l.unit_price) || 0,
          std_cost_unit: 0,
          quantity_ordered: Number(l.quantity) || 0,
          quantity_received: 0,
        })),
      });
    },
    onSuccess: (result) => {
      notify.success(`Purchase Order #${result.order_no} created`);
      setLines([]);
      setReference("");
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to create purchase order"),
  });

  const canSubmit = !!supplier && !!location && lines.length > 0 && !createMutation.isPending;

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              sx={{ flex: 1 }} options={suppliers ?? []} getOptionLabel={(s: any) => s.supp_name ?? ""}
              value={supplier} onChange={(_, v) => setSupplier(v)}
              renderInput={(p) => <TextField {...p} label="Supplier" size="small" />}
            />
            <Autocomplete
              sx={{ flex: 1 }} options={locations ?? []} getOptionLabel={(l: any) => l.location_name ?? l.loc_code ?? ""}
              value={location} onChange={(_, v) => setLocation(v)}
              renderInput={(p) => <TextField {...p} label="Deliver To Location" size="small" />}
            />
            <TextField
              label="Expected Delivery Date" type="date" size="small" sx={{ flex: 1 }}
              value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Reference (optional)" size="small" sx={{ flex: 1 }}
              value={reference} onChange={(e) => setReference(e.target.value)}
            />
          </Stack>

          <Divider />

          <Typography variant="subtitle2" fontWeight={700}>Add Item</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <Autocomplete
              sx={{ flex: 2 }} options={items ?? []} getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              value={pickedItem} onChange={(_, v) => setPickedItem(v)}
              renderInput={(p) => <TextField {...p} label="Product" size="small" />}
            />
            <Button size="small" onClick={() => setNewProductOpen(true)} sx={{ whiteSpace: "nowrap" }}>+ New Product</Button>
            <TextField label="Quantity" type="number" size="small" sx={{ width: 120 }} value={pickedQty} onChange={(e) => setPickedQty(e.target.value)} />
            <TextField label="Agreed Price" type="number" size="small" sx={{ width: 140 }} value={pickedPrice} onChange={(e) => setPickedPrice(e.target.value)} />
            <Button variant="outlined" startIcon={<AddIcon />} disabled={!pickedItem} onClick={addLine}>Add Row</Button>
          </Stack>

          {lines.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell><TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Price</TableCell><TableCell align="right">Line Total</TableCell>
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
                      <IconButton size="small" color="error" onClick={() => removeLine(l.key)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Total: {formatCurrency(total)}</Typography>
            <Button variant="contained" size="large" startIcon={<DescriptionIcon />} disabled={!canSubmit} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating..." : "Create Purchase Order"}
            </Button>
          </Stack>
        </Stack>
      </CardContent>

      <Dialog open={newProductOpen} onClose={() => setNewProductOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Product Name" fullWidth autoFocus
              value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
            />
            <Autocomplete
              options={categories ?? []}
              getOptionLabel={(c: any) => c.description ?? ""}
              value={newProductCategory}
              onChange={(_, v) => { setNewProductCategory(v); setNewProductBrand(null); setNewProductSubcategory(null); }}
              renderInput={(p) => <TextField {...p} label="Category" />}
            />
            <Autocomplete
              options={brandsForCategory}
              getOptionLabel={(b: any) => b.name ?? ""}
              value={newProductBrand}
              onChange={(_, v) => { setNewProductBrand(v); setNewProductSubcategory(null); }}
              disabled={!newProductCategory}
              renderInput={(p) => <TextField {...p} label="Brand (optional)" helperText={!newProductCategory ? "Pick a category first" : undefined} />}
            />
            <Autocomplete
              options={subcategories ?? []}
              getOptionLabel={(s: any) => s.name ?? ""}
              value={newProductSubcategory}
              onChange={(_, v) => setNewProductSubcategory(v)}
              disabled={!newProductBrand}
              renderInput={(p) => <TextField {...p} label="Subcategory (optional)" helperText={!newProductBrand ? "Pick a brand first" : undefined} />}
            />
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
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Goods Receipt — record what actually arrived against an order.
// ---------------------------------------------------------------------------
function GoodsReceiptTab() {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<any>(null);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [receivedQty, setReceivedQty] = useState<Record<number, string>>({});
  // New selling price / MRP per line (blank = keep the current price).
  const [batchPrices, setBatchPrices] = useState<Record<number, BatchPriceInput>>({});
  const retailPrices = useRetailPriceMap();
  const mrpMap = useMrpMap();

  const { data: orders } = useQuery({ queryKey: ["purch-orders-all"], queryFn: getPurchOrders });
  const { data: poLines, isFetching: loadingLines } = useQuery({
    queryKey: ["purch-order-details", order?.order_no],
    queryFn: () => getPurchOrderDetails(order.order_no),
    enabled: !!order,
  });

  const outstandingLines = (poLines ?? []).filter(
    (l: any) => (Number(l.quantity_ordered) || 0) - (Number(l.quantity_received) || 0) > 0.0001
  );

  // The quantity field pre-fills with the full remaining amount as a
  // display default, but that default only lives in the input's rendered
  // value — not in `receivedQty` state — until the user actually types
  // into it. Falling back to the same remaining-quantity default here (for
  // both the submit payload and the "is anything entered" check below)
  // keeps the button and the actual submitted data matching what's shown.
  const remainingFor = (l: any) => (Number(l.quantity_ordered) || 0) - (Number(l.quantity_received) || 0);
  const effectiveQty = (l: any) =>
    receivedQty[l.po_detail_item] !== undefined ? Number(receivedQty[l.po_detail_item]) || 0 : remainingFor(l);

  const receiveMutation = useMutation({
    mutationFn: () => postGrnReceive({
      order_no: order.order_no,
      reference: reference || undefined,
      delivery_date: deliveryDate,
      lines: outstandingLines
        .map((l: any) => ({ po_detail_item: l.po_detail_item, quantity: effectiveQty(l), ...batchPricePayload(batchPrices[l.po_detail_item]) }))
        .filter((l) => l.quantity > 0),
    }),
    onSuccess: (result) => {
      notify.success(`Goods received — GRN ${result?.reference ?? ""} posted, stock updated`);
      queryClient.invalidateQueries({ queryKey: ["purch-order-details", order?.order_no] });
      setReceivedQty({});
      setBatchPrices({});
      setReference("");
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to record goods receipt"),
  });

  const anyQtyEntered = outstandingLines.some((l: any) => effectiveQty(l) > 0);

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              sx={{ flex: 2 }}
              options={orders ?? []}
              getOptionLabel={(o: any) => `PO #${o.order_no} — ${o.reference ?? ""}`}
              value={order}
              onChange={(_, v) => { setOrder(v); setReceivedQty({}); setBatchPrices({}); }}
              renderInput={(p) => <TextField {...p} label="Purchase Order" size="small" />}
            />
            <TextField
              label="Delivery Date" type="date" size="small" sx={{ flex: 1 }}
              value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Reference / Delivery Note (optional)" size="small" sx={{ flex: 1 }}
              value={reference} onChange={(e) => setReference(e.target.value)}
            />
          </Stack>

          {order && !loadingLines && outstandingLines.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              This purchase order has already been fully received.
            </Typography>
          )}

          {outstandingLines.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Ordered</TableCell>
                  <TableCell align="right">Already Received</TableCell>
                  <TableCell align="right">Receiving Now</TableCell>
                  <BatchPriceHeadCells />
                </TableRow>
              </TableHead>
              <TableBody>
                {outstandingLines.map((l: any) => {
                  const remaining = (Number(l.quantity_ordered) || 0) - (Number(l.quantity_received) || 0);
                  return (
                    <TableRow key={l.po_detail_item}>
                      <TableCell>{l.description || l.item_code}</TableCell>
                      <TableCell align="right">{l.quantity_ordered}</TableCell>
                      <TableCell align="right">{l.quantity_received}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number" size="small" sx={{ width: 100 }}
                          value={receivedQty[l.po_detail_item] ?? String(remaining)}
                          onChange={(e) => setReceivedQty((prev) => ({ ...prev, [l.po_detail_item]: e.target.value }))}
                        />
                      </TableCell>
                      <BatchPriceCells
                        value={batchPrices[l.po_detail_item]}
                        onChange={(v) => setBatchPrices((prev) => ({ ...prev, [l.po_detail_item]: v }))}
                        currentPrice={retailPrices.get(String(l.item_code))}
                        currentMrp={mrpMap.get(String(l.item_code))}
                      />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <Button
            variant="contained" size="large" startIcon={<InventoryIcon />}
            disabled={!order || outstandingLines.length === 0 || receiveMutation.isPending || !anyQtyEntered}
            onClick={() => receiveMutation.mutate()}
            sx={{ alignSelf: "flex-start" }}
          >
            {receiveMutation.isPending ? "Recording..." : "Confirm Goods Received"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Supplier Invoice — the supplier's bill for goods already received.
// ---------------------------------------------------------------------------
function SupplierInvoiceTab() {
  const { formatCurrency } = useHomeCurrency();
  const [supplier, setSupplier] = useState<any>(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [suppReference, setSuppReference] = useState("");
  const [invoiceQty, setInvoiceQty] = useState<Record<number, string>>({});

  // "Pay in Full Now" — for cash-on-the-spot purchases. Still records the
  // real invoice first (the payable), then immediately posts a matching
  // payment allocated against it — same two genuine accounting steps as
  // paying later via the "Pay Supplier" tab, just chained together so it
  // feels like one action instead of two separate trips.
  const [payNow, setPayNow] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState<any>(null);

  const { data: suppliers } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: bankAccounts } = useQuery({ queryKey: ["bank-accounts"], queryFn: getBankAccounts });
  const { data: openItems, isFetching: loadingOpenItems } = useQuery({
    queryKey: ["open-grn-items", supplier?.supplier_id],
    queryFn: () => getOpenGrnItems({ supplier_id: supplier.supplier_id }),
    enabled: !!supplier,
  });

  // Same reasoning as the Goods Receipt tab: the "Invoicing Now" field
  // displays the full open quantity as a default, but that default isn't
  // in `invoiceQty` state until the user actually edits it — so both the
  // submit payload and the button's enabled state need to fall back to the
  // same default the field visibly shows, not the raw (possibly empty) state.
  const effectiveInvoiceQty = (it: any) =>
    invoiceQty[it.grn_item_id] !== undefined ? Number(invoiceQty[it.grn_item_id]) || 0 : Number(it.qty_open) || 0;

  const invoiceLines = (openItems ?? [])
    .map((it: any) => ({ ...it, qty: effectiveInvoiceQty(it) }))
    .filter((it: any) => it.qty > 0);
  const invoiceTotal = invoiceLines.reduce((sum: number, it: any) => sum + it.qty * (Number(it.unit_price) || 0), 0);

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      const result = await postSupplierInvoiceFromGrn({
        supplier_id: supplier.supplier_id,
        supp_reference: suppReference || undefined,
        trans_date: invoiceDate,
        lines: invoiceLines.map((it: any) => ({ grn_item_id: it.grn_item_id, quantity: it.qty })),
      });

      if (payNow && paymentAccount) {
        await postSupplierPayment({
          supplier_id: supplier.supplier_id,
          tran_date: invoiceDate,
          bank_account_id: paymentAccount.id,
          amount: invoiceTotal,
          reference: suppReference || undefined,
          allocations: [{ trans_no_to: result.trans_no, trans_type_to: result.trans_type, amt: invoiceTotal }],
        });
      }

      return result;
    },
    onSuccess: () => {
      notify.success(
        payNow && paymentAccount
          ? "Supplier invoice recorded and paid in full"
          : "Supplier invoice recorded — payable posted to accounts"
      );
      setInvoiceQty({});
      setSuppReference("");
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to record supplier invoice"),
  });

  const anyQtyEntered = invoiceLines.length > 0;

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              sx={{ flex: 1 }} options={suppliers ?? []} getOptionLabel={(s: any) => s.supp_name ?? ""}
              value={supplier} onChange={(_, v) => { setSupplier(v); setInvoiceQty({}); }}
              renderInput={(p) => <TextField {...p} label="Supplier" size="small" />}
            />
            <TextField
              label="Invoice Date" type="date" size="small" sx={{ flex: 1 }}
              value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Supplier Invoice Number" size="small" sx={{ flex: 1 }}
              value={suppReference} onChange={(e) => setSuppReference(e.target.value)}
            />
          </Stack>

          {supplier && !loadingOpenItems && (openItems ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No received-but-uninvoiced goods for this supplier.
            </Typography>
          )}

          {(openItems ?? []).length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>GRN Ref</TableCell>
                  <TableCell align="right">Received (Open)</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Invoicing Now</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(openItems ?? []).map((it: any) => (
                  <TableRow key={it.grn_item_id}>
                    <TableCell>{it.description || it.item_code}</TableCell>
                    <TableCell>{it.grn_reference}</TableCell>
                    <TableCell align="right">{it.qty_open}</TableCell>
                    <TableCell align="right">{formatCurrency(Number(it.unit_price) || 0)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number" size="small" sx={{ width: 100 }}
                        value={invoiceQty[it.grn_item_id] ?? String(it.qty_open)}
                        onChange={(e) => setInvoiceQty((prev) => ({ ...prev, [it.grn_item_id]: e.target.value }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {anyQtyEntered && (
            <>
              <FormControlLabel
                control={<Checkbox checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />}
                label="Pay in Full Now (paying cash on the spot, instead of on credit)"
              />
              {payNow && (
                <Autocomplete
                  sx={{ maxWidth: 320 }}
                  options={bankAccounts ?? []}
                  getOptionLabel={(a: any) => a.bank_account_name ?? ""}
                  value={paymentAccount}
                  onChange={(_, v) => setPaymentAccount(v)}
                  renderInput={(p) => <TextField {...p} label="Pay From" size="small" />}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                Invoice Total: {formatCurrency(invoiceTotal)}
              </Typography>
            </>
          )}

          <Button
            variant="contained" size="large" startIcon={<ReceiptIcon />}
            disabled={
              !supplier || (openItems ?? []).length === 0 || invoiceMutation.isPending ||
              !anyQtyEntered || (payNow && !paymentAccount)
            }
            onClick={() => invoiceMutation.mutate()}
            sx={{ alignSelf: "flex-start" }}
          >
            {invoiceMutation.isPending ? "Recording..." : payNow ? "Record Invoice & Pay Now" : "Record Supplier Invoice"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Pay Supplier — settle an outstanding invoice (credit purchases),
// whenever you're ready, separate from when the invoice was recorded.
// ---------------------------------------------------------------------------
function PaySupplierTab() {
  const { formatCurrency } = useHomeCurrency();
  const [supplier, setSupplier] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAccount, setPaymentAccount] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<Record<number, string>>({});

  const { data: suppliers } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: bankAccounts } = useQuery({ queryKey: ["bank-accounts"], queryFn: getBankAccounts });
  const { data: invoices, isFetching: loadingInvoices } = useQuery({
    queryKey: ["supplier-payment-allocatable", supplier?.supplier_id],
    queryFn: () => getSupplierPaymentAllocatable(supplier.supplier_id),
    enabled: !!supplier,
  });

  const effectivePayAmount = (inv: any) =>
    payAmount[inv.number] !== undefined ? Number(payAmount[inv.number]) || 0 : Number(inv.left) || 0;

  const totalToPay = (invoices ?? []).reduce((sum: number, inv: any) => sum + effectivePayAmount(inv), 0);

  const payMutation = useMutation({
    mutationFn: () => postSupplierPayment({
      supplier_id: supplier.supplier_id,
      tran_date: paymentDate,
      bank_account_id: paymentAccount.id,
      amount: totalToPay,
      allocations: (invoices ?? [])
        .map((inv: any) => ({ trans_no_to: inv.number, trans_type_to: inv.type_code, amt: effectivePayAmount(inv) }))
        .filter((a: any) => a.amt > 0),
    }),
    onSuccess: () => {
      notify.success("Payment recorded — supplier balance updated");
      setPayAmount({});
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to record payment"),
  });

  const anyAmountEntered = (invoices ?? []).some((inv: any) => effectivePayAmount(inv) > 0);

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              sx={{ flex: 1 }} options={suppliers ?? []} getOptionLabel={(s: any) => s.supp_name ?? ""}
              value={supplier} onChange={(_, v) => { setSupplier(v); setPayAmount({}); }}
              renderInput={(p) => <TextField {...p} label="Supplier" size="small" />}
            />
            <TextField
              label="Payment Date" type="date" size="small" sx={{ flex: 1 }}
              value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Autocomplete
              sx={{ flex: 1 }} options={bankAccounts ?? []} getOptionLabel={(a: any) => a.bank_account_name ?? ""}
              value={paymentAccount} onChange={(_, v) => setPaymentAccount(v)}
              renderInput={(p) => <TextField {...p} label="Pay From" size="small" />}
            />
          </Stack>

          {supplier && !loadingInvoices && (invoices ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              This supplier has no outstanding invoices.
            </Typography>
          )}

          {(invoices ?? []).length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell align="right">Paying Now</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(invoices ?? []).map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.number}{inv.supplier_ref ? ` (${inv.supplier_ref})` : ""}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.amount)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.left)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number" size="small" sx={{ width: 110 }}
                        value={payAmount[inv.number] ?? String(inv.left)}
                        onChange={(e) => setPayAmount((prev) => ({ ...prev, [inv.number]: e.target.value }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {anyAmountEntered && (
            <Typography variant="h6">Total to Pay: {formatCurrency(totalToPay)}</Typography>
          )}

          <Button
            variant="contained" size="large" startIcon={<PaymentIcon />}
            disabled={!supplier || !paymentAccount || (invoices ?? []).length === 0 || payMutation.isPending || !anyAmountEntered}
            onClick={() => payMutation.mutate()}
            sx={{ alignSelf: "flex-start" }}
          >
            {payMutation.isPending ? "Paying..." : "Pay Supplier"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
