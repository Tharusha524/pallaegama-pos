import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete, IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getItemVariants, createItemVariant, deleteItemVariant } from "../../../api/Pos/posAdvancedApi";
import { getItems } from "../../../api/Item/ItemApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

const emptyForm = { stock_id: null as any, variant_name: "", sku: "", barcode: "", price_adjustment: "0" };

export default function ProductVariantsPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: variants, isLoading } = useQuery({ queryKey: ["item-variants"], queryFn: () => getItemVariants() });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });

  const createMutation = useMutation({
    mutationFn: createItemVariant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-variants"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItemVariant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["item-variants"] }),
  });

  const handleSubmit = () => {
    if (!form.stock_id || !form.variant_name) return;
    createMutation.mutate({
      stock_id: form.stock_id.stock_id,
      variant_name: form.variant_name,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      price_adjustment: Number(form.price_adjustment) || 0,
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Product Variants" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Product Variants" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add Variant</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Product Variant</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={items ?? []}
              getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              value={form.stock_id}
              onChange={(_, val) => setForm({ ...form, stock_id: val })}
              renderInput={(params) => <TextField {...params} label="Base Product" />}
            />
            <TextField label="Variant Name" fullWidth value={form.variant_name} onChange={(e) => setForm({ ...form, variant_name: e.target.value })} placeholder="e.g. Red / Large" />
            <TextField label="SKU" fullWidth value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <TextField label="Barcode" fullWidth value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} helperText="Scan or type — used by POS Checkout's barcode scanner" />
            <TextField label="Price Adjustment" type="number" fullWidth value={form.price_adjustment} onChange={(e) => setForm({ ...form, price_adjustment: e.target.value })} helperText="Added to the base product's price" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.stock_id || !form.variant_name || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
