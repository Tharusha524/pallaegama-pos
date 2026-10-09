import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Box, Button, Stack, TextField, Autocomplete, Table, TableHead, TableRow,
  TableCell, TableBody, IconButton, Typography, Paper,
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
import { postDirectSupplierInvoice } from "../../../api/Purchases/PurchasesApi";
import { notify } from "../../../services/notificationService";

interface Line {
  id: number;
  item: any | null;
  description: string;
  quantity: string;
  unit_price: string;
}

let lineSeq = 1;
const emptyLine = (): Line => ({ id: lineSeq++, item: null, description: "", quantity: "1", unit_price: "0" });

export default function DirectSupplierInvoicePage() {
  const today = new Date().toISOString().slice(0, 10);

  const [supplier, setSupplier] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: locations = [] } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });
  const { data: items = [] } = useQuery({ queryKey: ["items-all"], queryFn: () => getItems() });

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
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (!supplier) throw new Error("Select a supplier");
      if (!location) throw new Error("Select a delivery location");
      const validLines = lines.filter((l) => l.item && Number(l.quantity) > 0);
      if (!validLines.length) throw new Error("Add at least one item");

      return postDirectSupplierInvoice({
        supplier_id: supplier.supplier_id,
        reference: reference || undefined,
        trans_date: invoiceDate,
        into_stock_location: location.loc_code ?? location.code ?? location.id,
        lines: validLines.map((l) => ({
          item_code: l.item.stock_id,
          description: l.description || l.item.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
        })),
      });
    },
    onSuccess: () => {
      notify.success("Supplier invoice posted successfully");
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
                <TableCell sx={{ width: "35%" }}>Product</TableCell>
                <TableCell sx={{ width: "25%" }}>Description</TableCell>
                <TableCell sx={{ width: "12%" }} align="right">Qty</TableCell>
                <TableCell sx={{ width: "15%" }} align="right">Unit Price (LKR)</TableCell>
                <TableCell sx={{ width: "10%" }} align="right">Amount</TableCell>
                <TableCell sx={{ width: "3%" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Autocomplete
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
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {((Number(line.quantity) || 0) * (Number(line.unit_price) || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
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

          {/* Footer */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1 }}>
            <Typography variant="h6">
              Total: LKR {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Typography>
            <Button
              variant="contained" size="large"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Posting…" : "Post Invoice"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </FormPageLayout>
  );
}
