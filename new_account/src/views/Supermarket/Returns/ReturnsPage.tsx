import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Stack, TextField, Button, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Typography, IconButton, FormControl, InputLabel, Select,
  MenuItem, Chip, Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { lookupInvoiceForReturn, createSalesReturn } from "../../../api/Pos/posOpsApi";
import { recordStockDamage } from "../../../api/Pos/posApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";

/**
 * "Process Return" — a supermarket-friendly wrapper around the ERP's real
 * Sales Credit Note flow (SalesCreditNoteController / SalesCreditNoteService).
 * We never write to debtor_trans/stock_moves/GL directly here — the actual
 * posting, stock restoration, and accounting entries are all done by that
 * same existing, already-verified backend service. Each returned line can
 * either be restocked (a real credit-note "Return", stock moves back to
 * loc_stock) or written off as damaged (posted as a write-off credit note,
 * with no stock movement, plus a Stock Damage record for the shrink log).
 */
type Line = {
  stock_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  qty_done: number;
  returnQty: string;
  disposition: "restock" | "damage";
};

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const { formatCurrency } = useHomeCurrency();
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState("");
  const [locCode, setLocCode] = useState("");

  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  const lookupMutation = useMutation({
    mutationFn: (transNo: number) => lookupInvoiceForReturn(transNo),
    onSuccess: (data) => {
      setInvoice(data);
      setLocCode(data.default_location || (locations ?? [])[0]?.loc_code || "");
      setLines(
        (data.lines ?? []).map((l: any) => {
          const alreadyReturned = Number(l.qty_done) || 0;
          const maxReturnable = Math.max(0, Number(l.quantity) - alreadyReturned);
          return {
            stock_id: l.stock_id,
            description: l.description,
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
            discount_percent: Number(l.discount_percent) || 0,
            qty_done: alreadyReturned,
            returnQty: String(maxReturnable),
            disposition: "restock" as const,
          };
        })
      );
    },
    onError: () => {
      setInvoice(null);
      setLines([]);
      notify.error("Invoice not found");
    },
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      const returnLines = lines.filter((l) => Number(l.returnQty) > 0);
      if (returnLines.length === 0) return;

      // Every returned line is posted as a real Return (stock+) credit note —
      // the customer is refunded and the quantity goes back into loc_stock,
      // exactly like the core ERP's own Credit Note screen would do.
      const credit = await createSalesReturn({
        debtor_no: invoice.debtor_no,
        branch_code: invoice.branch_code,
        tran_date: new Date().toISOString().slice(0, 10),
        order_type: invoice.order_type,
        ship_via: invoice.ship_via ?? undefined,
        from_stk_loc: locCode || undefined,
        // Not auto-allocating against the source invoice: a POS sale is
        // normally already fully paid, so it has no outstanding balance
        // left to allocate a credit against (the accounting layer
        // correctly rejects that). The credit posts standalone as a
        // customer refund/credit instead — the original invoice number
        // is kept in the reference/comment for a clear paper trail.
        comments: `${reason || "POS return"} (against invoice #${invoice.trans_no}, ref ${invoice.reference})`,
        return_of_invoice: Number(invoice.trans_no) || undefined,
        lines: returnLines.map((l) => ({
          stock_id: l.stock_id,
          quantity: Number(l.returnQty),
          unit_price: l.unit_price,
          discount_percent: l.discount_percent,
        })),
      });

      // Items marked "Damaged" shouldn't stay counted as sellable stock —
      // immediately log a Stock Damage entry, which decrements the same
      // quantity back out again and keeps a proper shrinkage record.
      const damageLines = returnLines.filter((l) => l.disposition === "damage");
      for (const l of damageLines) {
        await recordStockDamage({
          stock_id: l.stock_id,
          loc_code: locCode || undefined,
          quantity: Number(l.returnQty),
          reason: reason || "Customer return — damaged",
          damage_date: new Date().toISOString().slice(0, 10),
          return_trans_no: Number(credit?.trans_no) || undefined,
        });
      }
    },
    onSuccess: () => {
      notify.success("Return processed");
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      queryClient.invalidateQueries({ queryKey: ["stock-damages"] });
      setInvoice(null);
      setLines([]);
      setInvoiceNo("");
      setReason("");
    },
    onError: (e: any) => notify.error(e?.response?.data?.message ?? "Failed to process return"),
  });

  const hasReturnableLines = lines.some((l) => Number(l.returnQty) > 0);

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Process Return" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Process Return" }]} />
        <Typography variant="caption" color="text.secondary">
          Look up the original invoice, choose what's being returned, and whether it goes back on the shelf or is written off as damaged.
        </Typography>
      </Box>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small" label="Invoice / Reference No"
              value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button
              variant="contained"
              disabled={!invoiceNo.trim() || lookupMutation.isPending}
              onClick={() => lookupMutation.mutate(Number(invoiceNo.trim()))}
            >
              {lookupMutation.isPending ? "Looking up..." : "Find Invoice"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {invoice && (
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600}>
              Invoice #{invoice.trans_no} — {invoice.customer_name ?? `Debtor ${invoice.debtor_no}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Date: {String(invoice.tran_date).slice(0, 10)} · Total: {formatCurrency(Number(invoice.ov_amount) + Number(invoice.ov_gst))}
            </Typography>

            <TableContainer sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Sold Qty</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Return Qty</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((l, idx) => {
                    const maxReturnable = l.quantity - l.qty_done;
                    return (
                      <TableRow key={l.stock_id}>
                        <TableCell>{l.description}</TableCell>
                        <TableCell align="right">
                          {l.quantity}
                          {l.qty_done > 0 && (
                            <Chip size="small" sx={{ ml: 1 }} label={`${l.qty_done} already returned`} color="warning" />
                          )}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(l.unit_price)}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" type="number" sx={{ width: 90 }}
                            value={l.returnQty}
                            inputProps={{ min: 0, max: maxReturnable, step: "any" }}
                            onChange={(e) => {
                              const v = Math.min(Number(e.target.value) || 0, maxReturnable);
                              setLines((prev) => prev.map((p, i) => (i === idx ? { ...p, returnQty: String(v) } : p)));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Disposition</InputLabel>
                            <Select
                              value={l.disposition} label="Disposition"
                              onChange={(e) =>
                                setLines((prev) => prev.map((p, i) => (i === idx ? { ...p, disposition: e.target.value as any } : p)))
                              }
                            >
                              <MenuItem value="restock">Restock (sellable)</MenuItem>
                              <MenuItem value="damage">Damaged (write off)</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
              <TextField
                fullWidth size="small" label="Reason for return"
                value={reason} onChange={(e) => setReason(e.target.value)}
              />
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Restock Location</InputLabel>
                <Select value={locCode} label="Restock Location" onChange={(e) => setLocCode(e.target.value)}>
                  {(locations ?? []).map((loc: any) => (
                    <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {!hasReturnableLines && (
              <Alert severity="info" sx={{ mt: 2 }}>Enter a return quantity for at least one item.</Alert>
            )}

            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained" color="error"
                disabled={!hasReturnableLines || returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
              >
                {returnMutation.isPending ? "Processing..." : "Process Return & Refund"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </FormPageLayout>
  );
}
