import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, IconButton, Typography,
  Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getStockDamages, recordStockDamage, deleteStockDamage } from "../../../api/Pos/posApi";
import { getItems } from "../../../api/Item/ItemApi";

const emptyForm = { stock_id: null as any, quantity: "1", reason: "", damage_date: new Date().toISOString().slice(0, 10) };

export default function StockDamagePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: damages, isLoading } = useQuery({ queryKey: ["stock-damages"], queryFn: () => getStockDamages() });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });

  const createMutation = useMutation({
    mutationFn: recordStockDamage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-damages"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStockDamage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-damages"] }),
  });

  const handleSubmit = () => {
    if (!form.stock_id) return;
    createMutation.mutate({
      stock_id: form.stock_id.stock_id,
      quantity: Number(form.quantity) || 0,
      reason: form.reason,
      damage_date: form.damage_date,
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Stock Damage" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Stock Damage" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Record Damage</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(damages ?? []).map((d: any) => (
                <TableRow key={d.id} hover>
                  <TableCell>{d.stock?.description ?? d.stock_id}</TableCell>
                  <TableCell align="right">{d.quantity}</TableCell>
                  <TableCell>{d.reason ?? "—"}</TableCell>
                  <TableCell>{String(d.damage_date).slice(0, 10)}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(d.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!damages || damages.length === 0) && (
                <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No damaged stock recorded.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Stock Damage</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={items ?? []}
              getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              value={form.stock_id}
              onChange={(_, val) => setForm({ ...form, stock_id: val })}
              renderInput={(params) => <TextField {...params} label="Product" />}
            />
            <TextField label="Quantity Damaged" type="number" fullWidth value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <TextField label="Reason" fullWidth value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <TextField label="Damage Date" type="date" fullWidth value={form.damage_date} onChange={(e) => setForm({ ...form, damage_date: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.stock_id || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
