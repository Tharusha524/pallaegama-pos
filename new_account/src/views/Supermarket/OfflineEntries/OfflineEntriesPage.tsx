import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete,
  FormControl, InputLabel, Select, MenuItem, IconButton, Chip, Tabs, Tab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getOfflineEntries, createOfflineEntry, deleteOfflineEntry } from "../../../api/Pos/posOpsApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

const emptyForm = { entry_type: "sale" as "sale" | "purchase", entry_date: new Date().toISOString().slice(0, 10), debtor_no: null as any, total_amount: "0", method: "cash", notes: "" };

export default function OfflineEntriesPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"sale" | "purchase">("sale");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: entries, isLoading } = useQuery({ queryKey: ["offline-entries", tab], queryFn: () => getOfflineEntries(tab) });
  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });

  const createMutation = useMutation({
    mutationFn: createOfflineEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline-entries"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOfflineEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offline-entries"] }),
  });

  const handleSubmit = () => {
    createMutation.mutate({
      entry_type: form.entry_type,
      entry_date: form.entry_date,
      debtor_no: form.debtor_no?.debtor_no,
      total_amount: Number(form.total_amount) || 0,
      payment_breakdown: [{ method: form.method, amount: Number(form.total_amount) || 0 }],
      notes: form.notes,
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Offline Sales & Purchases" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Offline Entries" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ ...emptyForm, entry_type: tab }); setOpen(true); }}>
          Record Entry
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Offline Sales" value="sale" />
        <Tab label="Offline Purchases" value="purchase" />
      </Tabs>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Date</TableCell><TableCell>Party</TableCell><TableCell align="right">Amount</TableCell>
                <TableCell>Notes</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(entries ?? []).map((e: any) => (
                <TableRow key={e.id} hover>
                  <TableCell>{e.entry_date}</TableCell>
                  <TableCell>{e.debtor?.name ?? e.supplier?.supp_name ?? "—"}</TableCell>
                  <TableCell align="right">{formatCurrency(e.total_amount)}</TableCell>
                  <TableCell>{e.notes ?? "—"}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(e.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!entries || entries.length === 0) && (
                <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No offline entries recorded.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Offline {form.entry_type === "sale" ? "Sale" : "Purchase"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={form.entry_type} label="Type" onChange={(e) => setForm({ ...form, entry_type: e.target.value as any })}>
                <MenuItem value="sale">Sale</MenuItem>
                <MenuItem value="purchase">Purchase</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Date" type="date" fullWidth value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} InputLabelProps={{ shrink: true }} />
            <Autocomplete
              options={customers ?? []}
              getOptionLabel={(c: any) => c.name ?? ""}
              value={form.debtor_no}
              onChange={(_, val) => setForm({ ...form, debtor_no: val })}
              renderInput={(params) => <TextField {...params} label="Customer (optional)" />}
            />
            <TextField label="Total Amount" type="number" fullWidth value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Select value={form.method} label="Payment Method" onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="cheque">Cheque</MenuItem>
                <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                <MenuItem value="card">Card</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
