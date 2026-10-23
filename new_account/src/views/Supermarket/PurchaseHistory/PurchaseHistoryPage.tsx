import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Stack, TextField, Autocomplete, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getSuppliers } from "../../../api/Supplier/SupplierApi";
import { getPurchaseHistory, getPurchaseHistoryDetail, type PurchaseHistoryRow } from "../../../api/Purchases/PurchaseHistoryApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

/**
 * Purchase History — every purchase already posted (Purchase and Direct
 * Supplier Invoice), view only. Click a row to see its items with cost,
 * selling price and MRP.
 */
export default function PurchaseHistoryPage() {
  const { formatCurrency } = useHomeCurrency();
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PurchaseHistoryRow | null>(null);

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["purchase-history", fromDate, toDate, supplier?.supplier_id, search],
    queryFn: () => getPurchaseHistory({
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      supplier_id: supplier?.supplier_id || undefined,
      search: search.trim() || undefined,
    }),
  });
  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: ["purchase-history-detail", selected?.id],
    queryFn: () => getPurchaseHistoryDetail(selected!.id),
    enabled: !!selected,
  });

  const money = (v: unknown) => formatCurrency(Number(v) || 0, 2);
  const grandTotal = rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Purchase History" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Purchase History" }]} />
        <Typography variant="caption" color="text.secondary">
          All purchases already received — from Purchase and Direct Supplier Invoice. View only.
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="From" type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Autocomplete
              sx={{ minWidth: 240 }}
              options={Array.isArray(suppliers) ? suppliers : []}
              getOptionLabel={(o: any) => o.supp_name ?? ""}
              value={supplier}
              onChange={(_, v) => setSupplier(v)}
              renderInput={(p) => <TextField {...p} label="Supplier (all)" size="small" />}
            />
            <TextField label="Search product / reference" size="small" sx={{ flex: 1 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          </Stack>

          {isLoading ? <PageLoader /> : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>GRN #</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Total Qty</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => setSelected(r)}>
                      <TableCell>{r.delivery_date}</TableCell>
                      <TableCell>GRN #{r.id}</TableCell>
                      <TableCell>{r.reference ?? "—"}</TableCell>
                      <TableCell>{r.supp_name ?? "—"}</TableCell>
                      <TableCell>{r.location_name ?? r.loc_code}</TableCell>
                      <TableCell align="right">{r.item_count}</TableCell>
                      <TableCell align="right">{Number(r.total_qty)}</TableCell>
                      <TableCell align="right">{money(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2">No purchases in this period.</Typography></TableCell></TableRow>
                  )}
                  {rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ fontWeight: 700 }}>Total ({rows.length} purchases)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{money(grandTotal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          GRN #{selected?.id} — {selected?.supp_name ?? ""}
          <Typography variant="body2" color="text.secondary">
            {selected?.delivery_date} · {selected?.location_name ?? selected?.loc_code}{selected?.reference ? ` · Ref ${selected.reference}` : ""}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {detailLoading || !detail ? <PageLoader /> : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">Selling Price</TableCell>
                  <TableCell align="right">MRP</TableCell>
                  <TableCell align="right">Line Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell>{it.description}<Typography variant="caption" color="text.secondary" display="block">{it.item_code}</Typography></TableCell>
                    <TableCell align="right">{Number(it.qty_recd)}</TableCell>
                    <TableCell align="right">{money(it.unit_price)}{Number(it.discount_percent) > 0 ? ` (−${Number(it.discount_percent)}%)` : ""}</TableCell>
                    <TableCell align="right">{it.price_pending ? "Not set yet" : it.selling_price != null ? money(it.selling_price) : "—"}</TableCell>
                    <TableCell align="right">{it.price_pending ? "Not set yet" : it.mrp != null ? money(it.mrp) : "—"}</TableCell>
                    <TableCell align="right">{money(it.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
