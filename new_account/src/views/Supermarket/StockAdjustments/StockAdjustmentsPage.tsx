import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete,
  FormControl, InputLabel, Select, MenuItem, Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getStockAdjustments, createStockAdjustment } from "../../../api/Pos/posOpsApi";
import { getItems } from "../../../api/Item/ItemApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";

const emptyForm = { stock_id: null as any, loc_code: "", movement_type: "add" as "add" | "reduce" | "override", quantity: "0", reason: "" };

export default function StockAdjustmentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: adjustments, isLoading } = useQuery({ queryKey: ["stock-adjustments"], queryFn: () => getStockAdjustments() });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  const createMutation = useMutation({
    mutationFn: createStockAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const handleSubmit = () => {
    if (!form.stock_id || !form.loc_code) return;
    createMutation.mutate({
      stock_id: form.stock_id.stock_id,
      loc_code: form.loc_code,
      movement_type: form.movement_type,
      quantity: Number(form.quantity) || 0,
      reason: form.reason,
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Stock Adjustments" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Stock Adjustments" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Adjust Stock</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Product</TableCell><TableCell>Location</TableCell><TableCell>Type</TableCell>
                <TableCell align="right">Before</TableCell><TableCell align="right">Moved</TableCell><TableCell align="right">After</TableCell>
                <TableCell>Reason</TableCell><TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(adjustments ?? []).map((a: any) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.stock?.description ?? a.stock_id}</TableCell>
                  <TableCell>{a.loc_code}</TableCell>
                  <TableCell><Chip label={a.movement_type} size="small" /></TableCell>
                  <TableCell align="right">{a.quantity_before}</TableCell>
                  <TableCell align="right">{a.quantity_moved}</TableCell>
                  <TableCell align="right">{a.quantity_after}</TableCell>
                  <TableCell>{a.reason ?? "—"}</TableCell>
                  <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(!adjustments || adjustments.length === 0) && (
                <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2">No adjustments recorded.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adjust Stock</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={items ?? []}
              getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              value={form.stock_id}
              onChange={(_, val) => setForm({ ...form, stock_id: val })}
              renderInput={(params) => <TextField {...params} label="Product" />}
            />
            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select value={form.loc_code} label="Location" onChange={(e) => setForm({ ...form, loc_code: e.target.value })}>
                {(locations ?? []).map((loc: any) => (
                  <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Movement Type</InputLabel>
              <Select value={form.movement_type} label="Movement Type" onChange={(e) => setForm({ ...form, movement_type: e.target.value as any })}>
                <MenuItem value="add">Add Stock</MenuItem>
                <MenuItem value="reduce">Reduce Stock</MenuItem>
                <MenuItem value="override">Override (set exact quantity)</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Quantity" type="number" fullWidth value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <TextField label="Reason" fullWidth value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="waste / damage / general / count correction" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.stock_id || !form.loc_code || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Saving..." : "Apply Adjustment"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
