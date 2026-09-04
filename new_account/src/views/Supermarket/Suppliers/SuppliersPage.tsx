import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, IconButton, Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../../../api/Supplier/SupplierApi";
import { notify } from "../../../services/notificationService";

const emptyForm = { supp_name: "", contact: "" };

/**
 * A short supplier list for day-to-day supermarket use — see who your
 * suppliers are, add a new one, or fix a name/contact typo, without opening
 * the full Purchase → Maintenance → Suppliers screen (GL accounts, tax
 * groups, credit terms, currency — built for the accounts team, not quick
 * lookups). Same genuine createSupplier/updateSupplier/getSuppliers APIs —
 * just a focused front end. Full detailed setup is still available under
 * Purchase → Maintenance for whoever needs it.
 */
export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  const { data: suppliers, isLoading } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });

  const createMutation = useMutation({
    mutationFn: () => createSupplier({
      supp_name: form.supp_name.trim(),
      supp_short_name: form.supp_name.trim().slice(0, 30),
      contact: form.contact.trim(),
    }),
    onSuccess: () => {
      notify.success("Supplier added");
      queryClient.invalidateQueries({ queryKey: ["suppliers-all"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to add supplier"),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateSupplier(editingSupplier.supplier_id, {
      ...editingSupplier,
      supp_name: form.supp_name.trim(),
      supp_short_name: form.supp_name.trim().slice(0, 30),
      contact: form.contact.trim(),
    }),
    onSuccess: () => {
      notify.success("Supplier updated");
      queryClient.invalidateQueries({ queryKey: ["suppliers-all"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to update supplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      notify.success("Supplier removed");
      queryClient.invalidateQueries({ queryKey: ["suppliers-all"] });
    },
    onError: () => notify.error("Failed to remove supplier — it may already be used on a purchase"),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingSupplier(null);
    setForm(emptyForm);
  };

  const openAddDialog = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEditDialog = (s: any) => {
    setEditingSupplier(s);
    setForm({ supp_name: s.supp_name ?? "", contact: s.contact ?? "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (editingSupplier) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Suppliers" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Suppliers" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>Add Supplier</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(suppliers ?? []).map((s: any) => (
                <TableRow key={s.supplier_id} hover>
                  <TableCell>{s.supp_name}</TableCell>
                  <TableCell>{s.contact || "—"}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit Supplier">
                      <IconButton size="small" onClick={() => openEditDialog(s)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(s.supplier_id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!suppliers || suppliers.length === 0) && (
                <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">No suppliers yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Supplier Name" fullWidth autoFocus
              value={form.supp_name} onChange={(e) => setForm({ ...form, supp_name: e.target.value })}
            />
            <TextField
              label="Contact / Mobile (optional)" fullWidth
              value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })}
              helperText="Payment terms, credit limit, and GL accounts can be set later from Purchase → Maintenance → Suppliers"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.supp_name.trim() || createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
