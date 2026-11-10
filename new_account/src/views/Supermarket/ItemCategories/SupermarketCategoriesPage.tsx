import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, IconButton, Tooltip,
  Tabs, Tab, Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CategoryIcon from "@mui/icons-material/Category";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BrandingWatermarkIcon from "@mui/icons-material/BrandingWatermark";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getItemCategories, createItemCategory, updateItemCategory, deleteItemCategory } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory } from "../../../api/Subcategories/SubcategoriesApi";
import { getBrands, createBrand, updateBrand, deleteBrand } from "../../../api/Brands/BrandsApi";
import { getChartMasters } from "../../../api/GLAccounts/ChartMasterApi";
import { getItemTaxTypes } from "../../../api/ItemTaxType/ItemTaxTypeApi";
import { getItemUnits } from "../../../api/ItemUnit/ItemUnitApi";
import { getItemTypes } from "../../../api/ItemType/ItemType";
import { notify } from "../../../services/notificationService";

/**
 * Product organization for the supermarket — Category (required, real
 * accounting mapping), and two optional labels layered on top: Subcategory
 * (one level under a Category) and Brand. Subcategory/Brand are pure
 * organization data — no GL accounts, nothing accounting-related reads
 * them — kept as short tabs on one page, same pattern as Purchase.
 */
export default function SupermarketCategoriesPage() {
  const [tab, setTab] = useState(0);

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Category" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Category" }]} />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<CategoryIcon fontSize="small" />} iconPosition="start" label="Categories" />
        <Tab icon={<BrandingWatermarkIcon fontSize="small" />} iconPosition="start" label="Brands" />
        <Tab icon={<AccountTreeIcon fontSize="small" />} iconPosition="start" label="Subcategories" />
      </Tabs>

      {tab === 0 && <CategoriesTab />}
      {tab === 1 && <BrandsTab />}
      {tab === 2 && <SubcategoriesTab />}
    </FormPageLayout>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Categories — required, drives real GL accounts (unchanged).
// ---------------------------------------------------------------------------
function CategoriesTab() {
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
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>Add Category</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(categories ?? []).map((c: any) => (
                <TableRow key={c.category_id} hover>
                  <TableCell>{c.description}</TableCell>
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
                <TableRow><TableCell colSpan={2} align="center"><Typography variant="body2">No categories yet.</Typography></TableCell></TableRow>
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Subcategories — optional, one level under a Category. Pure label,
// no GL accounts — the category's own accounts still apply to the product.
// ---------------------------------------------------------------------------
function SubcategoriesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);

  const { data: categories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories() });
  const { data: subcategories, isLoading } = useQuery({ queryKey: ["subcategories-all"], queryFn: () => getSubcategories() });

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setName("");
    setCategory(null);
  };

  const createMutation = useMutation({
    mutationFn: () => createSubcategory({ category_id: category.category_id, name: name.trim() }),
    onSuccess: () => {
      notify.success("Subcategory added");
      queryClient.invalidateQueries({ queryKey: ["subcategories-all"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to add subcategory"),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateSubcategory(editing.id, { category_id: category.category_id, name: name.trim() }),
    onSuccess: () => {
      notify.success("Subcategory updated");
      queryClient.invalidateQueries({ queryKey: ["subcategories-all"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to update subcategory"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubcategory,
    onSuccess: () => {
      notify.success("Subcategory removed");
      queryClient.invalidateQueries({ queryKey: ["subcategories-all"] });
    },
    onError: () => notify.error("Failed to remove subcategory"),
  });

  const openAddDialog = () => {
    setEditing(null);
    setName("");
    setCategory(null);
    setOpen(true);
  };

  const openEditDialog = (s: any) => {
    setEditing(s);
    setName(s.name);
    setCategory((categories ?? []).find((c: any) => c.category_id === s.category_id) ?? null);
    setOpen(true);
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>Add Subcategory</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(subcategories ?? []).map((s: any) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.category?.description ?? "—"}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit Subcategory">
                      <IconButton size="small" onClick={() => openEditDialog(s)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(s.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!subcategories || subcategories.length === 0) && (
                <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">No subcategories yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Edit Subcategory" : "Add Subcategory"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={categories ?? []}
              getOptionLabel={(c: any) => c.description ?? ""}
              value={category}
              onChange={(_, v) => setCategory(v)}
              renderInput={(p) => <TextField {...p} label="Category" />}
            />
            <TextField
              label="Subcategory Name" fullWidth autoFocus
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim() || !category || createMutation.isPending || updateMutation.isPending}
            onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Brands — optional, simple named list, no accounting fields at all.
// ---------------------------------------------------------------------------
function BrandsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<any>(null);

  const { data: brands, isLoading } = useQuery({ queryKey: ["brands-all"], queryFn: getBrands });

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setName("");
  };

  const createMutation = useMutation({
    mutationFn: () => createBrand({ name: name.trim() }),
    onSuccess: () => {
      notify.success("Brand added");
      queryClient.invalidateQueries({ queryKey: ["brands-all"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to add brand"),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateBrand(editing.id, { name: name.trim() }),
    onSuccess: () => {
      notify.success("Brand updated");
      queryClient.invalidateQueries({ queryKey: ["brands-all"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to update brand"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      notify.success("Brand removed");
      queryClient.invalidateQueries({ queryKey: ["brands-all"] });
    },
    onError: () => notify.error("Failed to remove brand"),
  });

  const openAddDialog = () => {
    setEditing(null);
    setName("");
    setOpen(true);
  };

  const openEditDialog = (b: any) => {
    setEditing(b);
    setName(b.name);
    setOpen(true);
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>Add Brand</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(brands ?? []).map((b: any) => (
                <TableRow key={b.id} hover>
                  <TableCell>{b.name}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit Brand">
                      <IconButton size="small" onClick={() => openEditDialog(b)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(b.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!brands || brands.length === 0) && (
                <TableRow><TableCell colSpan={2} align="center"><Typography variant="body2">No brands yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Edit Brand" : "Add Brand"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Brand Name" fullWidth autoFocus
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
            onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
