import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Stack, TextField, Autocomplete, Table, TableHead, TableRow,
  TableCell, TableBody, IconButton, Typography, Paper, Checkbox, FormControlLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useQuery } from "@tanstack/react-query";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getSuppliers } from "../../../api/Supplier/SupplierApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { getItems } from "../../../api/Item/ItemApi";
import { postDirectSupplierInvoice, postSupplierPayment } from "../../../api/Purchases/PurchasesApi";
import { getBankAccounts } from "../../../api/BankAccount/BankAccountApi";
import { getLastPurchaseCosts } from "../../../api/Purchases/PurchaseHistoryApi";
import { notify } from "../../../services/notificationService";
import { BatchPriceCells, BatchPriceHeadCells, batchPricePayload, emptyBatchPrice, useRetailPriceMap, type BatchPriceInput } from "../../../components/BatchPriceFields";
import ItemAutocomplete from "../../../components/ItemAutocomplete";

interface Line {
  id: number;
  item: any | null;
  description: string;
  quantity: string;
  unit_price: string;
  // New selling price / MRP for this delivery (blank = keep the current price).
  batch: BatchPriceInput;
}

let lineSeq = 1;
const emptyLine = (): Line => ({ id: lineSeq++, item: null, description: "", quantity: "1", unit_price: "0", batch: emptyBatchPrice });


export default function DirectSupplierInvoicePage() {
  const today = new Date().toISOString().slice(0, 10);
  const queryClient = useQueryClient();

  const [supplier, setSupplier] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  // Optional pay-on-the-spot, for a supplier paid when the goods arrive.
  // Left unticked the bill is on credit, exactly as before.
  const [payNow, setPayNow] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(""); // blank = pay the full bill

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: locations = [] } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });
  const { data: items = [] } = useQuery({ queryKey: ["items-all"], queryFn: () => getItems() });
  // What each item was last bought at — shown under the Purchase Price box.
  const { data: lastCosts = {} } = useQuery({ queryKey: ["last-purchase-costs"], queryFn: getLastPurchaseCosts });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ["bank-accounts"], queryFn: getBankAccounts });

  const retailPrices = useRetailPriceMap();

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  const setLine = (id: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: number) => setLines((prev) => prev.filter((l) => l.id !== id));

  const reset = () => {
    setSupplier(null);
    setLocation(null);
    setInvoiceDate(today);
    setReference("");
    setLines([emptyLine()]);
    setPayNow(false);
    setPaymentAccount(null);
    setPayAmount("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!supplier) throw new Error("Select a supplier");
      if (!location) throw new Error("Select a delivery location");
      const validLines = lines.filter((l) => l.item && Number(l.quantity) > 0);
      if (!validLines.length) throw new Error("Add at least one item");

      // Checked before anything is posted, so a bad payment entry never
      // leaves a half-done invoice behind.
      const wantedPay = payAmount.trim() === "" ? total : Number(payAmount);
      if (payNow) {
        if (!paymentAccount) throw new Error("Select where the payment is made from");
        if (!(wantedPay > 0)) throw new Error("Payment amount must be more than zero");
        if (wantedPay > total + 0.005) throw new Error("Payment cannot be more than the bill total");
      }

      const invoice = await postDirectSupplierInvoice({
        supplier_id: supplier.supplier_id,
        reference: reference || undefined,
        trans_date: invoiceDate,
        into_stock_location: location.loc_code ?? location.code ?? location.id,
        lines: validLines.map((l) => ({
          item_code: l.item.stock_id,
          description: l.description || l.item.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          ...batchPricePayload(l.batch),
        })),
      });

      if (!payNow) return { invoice, paid: 0, payError: null as string | null };

      // The same supplier payment the Purchase page's "Pay in Full Now" and
      // "Pay Supplier" tab use: a payment document, its bank/cash line and
      // ledger entries, allocated straight to the invoice just posted. Capped
      // at what the server actually booked, in case it rounds differently.
      const st = invoice?.supp_trans ?? {};
      const booked = Number(st.ov_amount ?? 0) + Number(st.ov_gst ?? 0);
      const amount = Math.round(Math.min(wantedPay, booked > 0 ? booked : wantedPay) * 100) / 100;
      try {
        await postSupplierPayment({
          supplier_id: supplier.supplier_id,
          tran_date: invoiceDate,
          bank_account_id: paymentAccount.id,
          amount,
          reference: reference || undefined,
          allocations: [{ trans_no_to: invoice.trans_no, trans_type_to: invoice.trans_type, amt: amount }],
        });
        return { invoice, paid: amount, payError: null as string | null };
      } catch (err: any) {
        // The invoice is already posted and stays posted; only the payment
        // failed. Say so plainly so it gets paid from Pay Supplier, rather
        // than the whole bill being entered again.
        return { invoice, paid: 0, payError: err?.response?.data?.message ?? err?.message ?? "Payment failed" };
      }
    },
    onSuccess: ({ invoice, paid, payError }) => {
      const ref = invoice?.reference ? ` (${invoice.reference})` : "";
      const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (payError) {
        notify.error(`Invoice${ref} was posted, but the payment was NOT recorded: ${payError}. Pay it from Purchase > Pay Supplier.`);
      } else if (paid > 0) {
        const left = Math.max(0, total - paid);
        notify.success(left > 0.005
          ? `Invoice${ref} posted and LKR ${fmt(paid)} paid. LKR ${fmt(left)} still owed.`
          : `Invoice${ref} posted and paid in full`);
      } else {
        notify.success(`Supplier invoice${ref} posted on credit`);
      }
      queryClient.invalidateQueries({ queryKey: ["last-purchase-costs"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payment-allocatable"] });
      reset();
    },
    onError: (err: any) => {
      notify.error(err?.response?.data?.message ?? err?.message ?? "Failed to post invoice");
    },
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Direct Supplier Invoice" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Direct Supplier Invoice" }]} />
        <Typography variant="caption" color="text.secondary">
          Receive stock and post a supplier invoice in one step — skips PO and GRN.
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(o: any) => o.supp_name ?? ""}
              value={supplier}
              onChange={(_, v) => setSupplier(v)}
              renderInput={(params) => <TextField {...params} label="Supplier *" size="small" />}
              sx={{ flex: 1 }}
            />
            <Autocomplete
              options={Array.isArray(locations) ? locations : (locations as any)?.data ?? []}
              getOptionLabel={(o: any) => o.location_name ?? o.loc_code ?? ""}
              value={location}
              onChange={(_, v) => setLocation(v)}
              renderInput={(params) => <TextField {...params} label="Deliver To Location *" size="small" />}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Invoice Date" type="date" size="small" value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 180 }}
            />
            <TextField
              label="Reference (optional)" size="small" value={reference}
              onChange={(e) => setReference(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>

          {/* Lines */}
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell sx={{ width: "28%" }}>Product</TableCell>
                <TableCell sx={{ width: "17%" }}>Description</TableCell>
                <TableCell sx={{ width: "12%" }} align="right">Qty</TableCell>
                <TableCell sx={{ width: "15%" }} align="right">Purchase Price (LKR)</TableCell>
                <BatchPriceHeadCells />
                <TableCell sx={{ width: "10%" }} align="right">Amount</TableCell>
                <TableCell sx={{ width: "3%" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow
                  key={line.id}
                  // Keep every box on one line; the "Last purchase" note sits under its box.
                  sx={{ "& > td": { verticalAlign: "top" } }}
                >
                  <TableCell>
                    <ItemAutocomplete
                      options={Array.isArray(items) ? items : (items as any)?.data ?? []}
                      getOptionLabel={(o: any) => `${o.stock_id} — ${o.description}`}
                      value={line.item}
                      onChange={(_, v) => setLine(line.id, {
                        item: v,
                        description: v?.description ?? "",
                        unit_price: v?.purchase_cost != null ? String(v.purchase_cost) : line.unit_price,
                      })}
                      renderInput={(params) => <TextField {...params} size="small" placeholder="Search product…" />}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small" fullWidth value={line.description}
                      onChange={(e) => setLine(line.id, { description: e.target.value })}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small" type="number" value={line.quantity}
                      onChange={(e) => setLine(line.id, { quantity: e.target.value })}
                      inputProps={{ min: 0, step: "any", style: { textAlign: "right" } }}
                      sx={{ width: 90 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small" type="number" value={line.unit_price}
                      onChange={(e) => setLine(line.id, { unit_price: e.target.value })}
                      inputProps={{ min: 0, step: "any", style: { textAlign: "right" } }}
                      sx={{ width: 120 }}
                    />
                    {line.item && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {(() => {
                          const last = lastCosts[String(line.item.stock_id)];
                          if (!last) return "Last purchase: none yet";
                          const price = Number(last.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          const disc = Number(last.discount_percent) > 0 ? ` −${Number(last.discount_percent)}%` : "";
                          return `Last purchase: LKR ${price}${disc} (${last.date}${last.supplier ? `, ${last.supplier}` : ""})`;
                        })()}
                      </Typography>
                    )}
                  </TableCell>
                  <BatchPriceCells
                    value={line.batch}
                    onChange={(v) => setLine(line.id, { batch: v })}
                    currentPrice={line.item ? retailPrices.get(String(line.item.stock_id)) : undefined}
                    currentMrp={line.item?.mrp_price != null ? Number(line.item.mrp_price) : undefined}
                  />
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ pt: 1 }}>
                      {((Number(line.quantity) || 0) * (Number(line.unit_price) || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" sx={{ mt: 0.5 }} onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button startIcon={<AddIcon />} onClick={addLine} sx={{ alignSelf: "flex-start" }}>
            Add Line
          </Button>

          {/* Payment (optional) */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
            <FormControlLabel
              control={<Checkbox checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />}
              label="Pay now (instead of on credit)"
            />
            {payNow && (
              <>
                <Autocomplete
                  sx={{ width: 260 }}
                  options={Array.isArray(bankAccounts) ? bankAccounts : (bankAccounts as any)?.data ?? []}
                  getOptionLabel={(a: any) => a.bank_account_name ?? ""}
                  value={paymentAccount}
                  onChange={(_, v) => setPaymentAccount(v)}
                  renderInput={(p) => <TextField {...p} label="Pay From *" size="small" />}
                />
                <TextField
                  label="Amount Paid" size="small" type="number" value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={total.toFixed(2)}
                  helperText={payAmount.trim() === ""
                    ? "Blank = full bill"
                    : Number(payAmount) < total
                      ? `LKR ${(total - (Number(payAmount) || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} stays owed`
                      : " "}
                  inputProps={{ min: 0, step: "any", style: { textAlign: "right" } }}
                  sx={{ width: 200 }}
                />
              </>
            )}
          </Stack>

          {/* Footer */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1 }}>
            <Typography variant="h6">
              Total: LKR {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
            <Button
              variant="contained" size="large"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Posting…" : payNow ? "Post Invoice & Pay" : "Post Invoice"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </FormPageLayout>
  );
}
