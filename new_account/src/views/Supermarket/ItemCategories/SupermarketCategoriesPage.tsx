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
import { getItemCategories, createItemCategory, updateItemCategory, deleteItemCategory } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getChartMasters } from "../../../api/GLAccounts/ChartMasterApi";
import { getItemTaxTypes } from "../../../api/ItemTaxType/ItemTaxTypeApi";
import { getItemUnits } from "../../../api/ItemUnit/ItemUnitApi";
import { getItemTypes } from "../../../api/ItemType/ItemType";
import { notify } from "../../../services/notificationService";

/**
 * A short supermarket-facing view of product categories — see what
 * categories exist, add one, rename one, or remove one, without the full
 * Item and Inventory → Maintenance → Item Categories screen's GL account
 * dropdowns. New/edited categories still use real, valid accounts — the
 * same defaults (Sales/Inventory/COGS/Adjustment/Assembly) the full screen
 * itself falls back to — just never shown here. Fine-tune an individual
 * category's account mapping later from that full screen if ever needed.
 */
export default function SupermarketCategoriesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const { data: categories, isLoading } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories() });
  const { data: chartMasters } = useQuery({ queryKey: ["chart-masters"], queryFn: getChartMasters });
  const { data: taxTypes } = useQuery({ queryKey: ["item-tax-types"], queryFn: getItemTaxTypes });
  const { data: units } = useQuery({ queryKey: ["item-units"], queryFn: getItemUnits });
  const { data: itemTypes } = useQuery({ queryKey: ["item-types"], queryFn: getItemTypes });

  const defaultLookups = () => ({
    dflt_tax_type: (taxTypes ?? [])[0]?.id,
    dflt_units: (units ?? []).find((u: any) => /each/i.test(u.name ?? ""))?.id ?? (units ?? [])[0]?.id,
    dflt_mb_flag: (itemTypes ?? []).find((t: any) => /purchased/i.test(t.name ?? ""))?.id ?? (itemTypes ?? [])[0]?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => createItemCategory({ description: name.trim(), ...defaultLookups() }, chartMasters ?? []),
    onSuccess: () => {
      notify.success("Category added");
      queryClient.invalidateQueries({ queryKey: ["item-categories"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to add category"),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateItemCategory(
      editingCategory.category_id,
      { ...editingCategory, description: name.trim() },
      chartMasters ?? []
    ),
    onSuccess: () => {
      notify.success("Category updated");
      queryClient.invalidateQueries({ queryKey: ["item-categories"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to update category"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItemCategory,
    onSuccess: () => {
      notify.success("Category removed");
      queryClient.invalidateQueries({ queryKey: ["item-categories"] });
    },
    onError: () => notify.error("Failed to remove category — it may already have products in it"),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingCategory(null);
    setName("");
  };

  const openAddDialog = () => {
    setEditingCategory(null);
    setName("");
    setOpen(true);
  };

  const openEditDialog = (c: any) => {
    setEditingCategory(c);
    setName(c.description ?? "");
    setOpen(true);
  };

  const handleSubmit = () => {
    if (editingCategory) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Category" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Category" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>Add Category</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Sales Acc.</TableCell>
                <TableCell>Inventory Acc.</TableCell>
                <TableCell>COGS Acc.</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(categories ?? []).map((c: any) => (
                <TableRow key={c.category_id} hover>
                  <TableCell>{c.description}</TableCell>
                  <TableCell>{c.dflt_sales_act ?? "—"}</TableCell>
                  <TableCell>{c.dflt_inventory_act ?? "—"}</TableCell>
                  <TableCell>{c.dflt_cogs_act ?? "—"}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit Category">
                      <IconButton size="small" onClick={() => openEditDialog(c)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(c.category_id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!categories || categories.length === 0) && (
                <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No categories yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Category Name" fullWidth autoFocus sx={{ mt: 1 }}
            value={name} onChange={(e) => setName(e.target.value)}
            helperText="Uses the standard default accounts — adjust them later from Item and Inventory → Item Categories if needed"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
