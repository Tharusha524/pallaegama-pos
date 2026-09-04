import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, IconButton, Typography,
  FormControl, InputLabel, Select, MenuItem, Chip, Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getOffers, createOffer, updateOffer, deleteOffer, getOfferPopularity } from "../../../api/Loyalty/loyaltyApi";
import { getLoyaltyTiers } from "../../../api/Loyalty/loyaltyApi";
import { getItems } from "../../../api/Item/ItemApi";
import { getItemCategories } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";

const emptyForm = {
  offer_name: "", offer_type: "product", discount_type: "percent",
  discount_value: "10", valid_from: new Date().toISOString().slice(0, 10),
  valid_to: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  min_purchase_amount: "0",
};

export default function OffersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingOffer, setEditingOffer] = useState<any>(null);

  // Target selections, kept as real objects (so we can show names) — collapsed
  // into the offer's single target_id string only on submit.
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const { data: offers, isLoading } = useQuery({ queryKey: ["offers"], queryFn: getOffers });
  const { data: popularity } = useQuery({ queryKey: ["offer-popularity"], queryFn: getOfferPopularity });
  // Not gated on `open` — Edit needs these loaded up front to pre-select the
  // offer's current target the moment its dialog opens.
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: categories } = useQuery({ queryKey: ["item-categories"], queryFn: () => getItemCategories() });
  const { data: tiers } = useQuery({ queryKey: ["loyalty-tiers"], queryFn: getLoyaltyTiers });
  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });

  // Look up product names for the target list shown in the offers table.
  const { data: allItemsForDisplay } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const itemNameByStockId = new Map((allItemsForDisplay ?? []).map((i: any) => [i.stock_id, i.description]));

  const popularityMap = new Map<number, number>((popularity ?? []).map((p: any) => [p.offer_id, Number(p.redemption_count)]));

  const closeDialog = () => {
    setOpen(false);
    setEditingOffer(null);
    setForm(emptyForm);
    setSelectedProducts([]);
    setSelectedCategory(null);
    setSelectedTier(null);
    setSelectedCustomer(null);
  };

  const createMutation = useMutation({
    mutationFn: createOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateOffer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offers"] }),
  });

  const openAddDialog = () => {
    setEditingOffer(null);
    setForm(emptyForm);
    setSelectedProducts([]);
    setSelectedCategory(null);
    setSelectedTier(null);
    setSelectedCustomer(null);
    setOpen(true);
  };

  const openEditDialog = (offer: any) => {
    setEditingOffer(offer);
    setForm({
      offer_name: offer.offer_name,
      offer_type: offer.offer_type,
      discount_type: offer.discount_type,
      discount_value: String(offer.discount_value ?? "0"),
      valid_from: String(offer.valid_from).slice(0, 10),
      valid_to: String(offer.valid_to).slice(0, 10),
      min_purchase_amount: String(offer.min_purchase_amount ?? "0"),
    });

    // Pre-select the target so the Autocomplete shows the current value.
    const ids = String(offer.target_id ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
    setSelectedProducts(offer.offer_type === "product" ? (items ?? []).filter((i: any) => ids.includes(i.stock_id)) : []);
    setSelectedCategory(offer.offer_type === "category" ? (categories ?? []).find((c: any) => String(c.category_id) === ids[0]) ?? null : null);
    setSelectedTier(offer.offer_type === "tier" ? (tiers ?? []).find((t: any) => String(t.id) === ids[0]) ?? null : null);
    setSelectedCustomer(offer.offer_type === "customer" ? (customers ?? []).find((c: any) => String(c.debtor_no) === ids[0]) ?? null : null);

    setOpen(true);
  };

  const resolveTargetId = (): string => {
    switch (form.offer_type) {
      case "product":
        return selectedProducts.map((p) => p.stock_id).join(",");
      case "category":
        return selectedCategory ? String(selectedCategory.category_id) : "";
      case "tier":
        return selectedTier ? String(selectedTier.id) : "";
      case "customer":
        return selectedCustomer ? String(selectedCustomer.debtor_no) : "";
      default:
        return "";
    }
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      target_id: resolveTargetId(),
      discount_value: Number(form.discount_value) || 0,
      min_purchase_amount: Number(form.min_purchase_amount) || 0,
    };
    if (editingOffer) {
      updateMutation.mutate({ id: editingOffer.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const targetIsValid =
    (form.offer_type === "product" && selectedProducts.length > 0) ||
    (form.offer_type === "category" && !!selectedCategory) ||
    (form.offer_type === "tier" && !!selectedTier) ||
    (form.offer_type === "customer" && !!selectedCustomer);

  const displayTarget = (offer: any) => {
    if (offer.offer_type === "product") {
      const ids = String(offer.target_id ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      return ids.map((id: string) => itemNameByStockId.get(id) ?? id).join(", ");
    }
    return offer.target_id;
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Offers & Discounts" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Offers & Discounts" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>Add Offer</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Offer Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Target</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell>Valid Period</TableCell>
                <TableCell align="center">Redemptions</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(offers ?? []).map((offer: any) => (
                <TableRow key={offer.id} hover>
                  <TableCell>{offer.offer_name}</TableCell>
                  <TableCell>{offer.offer_type}</TableCell>
                  <TableCell>{displayTarget(offer)}</TableCell>
                  <TableCell align="right">
                    {offer.discount_type === "percent" ? `${offer.discount_value}%` : offer.discount_value}
                  </TableCell>
                  <TableCell>{String(offer.valid_from).slice(0, 10)} – {String(offer.valid_to).slice(0, 10)}</TableCell>
                  <TableCell align="center">{popularityMap.get(offer.id) ?? 0}</TableCell>
                  <TableCell align="center">
                    <Chip label={offer.status} size="small" color={offer.status === "active" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEditDialog(offer)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(offer.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!offers || offers.length === 0) && (
                <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2">No offers configured yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingOffer ? "Edit Offer" : "Add Offer"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Offer Name" fullWidth value={form.offer_name} onChange={(e) => setForm({ ...form, offer_name: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Offer Type</InputLabel>
              <Select value={form.offer_type} label="Offer Type" onChange={(e) => setForm({ ...form, offer_type: e.target.value })}>
                <MenuItem value="product">Product(s)</MenuItem>
                <MenuItem value="category">Category</MenuItem>
                <MenuItem value="tier">Loyalty Tier</MenuItem>
                <MenuItem value="customer">Specific Customer</MenuItem>
              </Select>
            </FormControl>

            {form.offer_type === "product" && (
              <Autocomplete
                multiple
                options={items ?? []}
                getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
                value={selectedProducts}
                onChange={(_, val) => setSelectedProducts(val)}
                renderInput={(params) => <TextField {...params} label="Products" placeholder="Search by name" />}
              />
            )}
            {form.offer_type === "category" && (
              <Autocomplete
                options={categories ?? []}
                getOptionLabel={(c: any) => c.description ?? ""}
                value={selectedCategory}
                onChange={(_, val) => setSelectedCategory(val)}
                renderInput={(params) => <TextField {...params} label="Category" />}
              />
            )}
            {form.offer_type === "tier" && (
              <Autocomplete
                options={tiers ?? []}
                getOptionLabel={(t: any) => t.tier_name ?? ""}
                value={selectedTier}
                onChange={(_, val) => setSelectedTier(val)}
                renderInput={(params) => <TextField {...params} label="Loyalty Tier" />}
              />
            )}
            {form.offer_type === "customer" && (
              <Autocomplete
                options={customers ?? []}
                getOptionLabel={(c: any) => c.name ?? ""}
                value={selectedCustomer}
                onChange={(_, val) => setSelectedCustomer(val)}
                renderInput={(params) => <TextField {...params} label="Customer" />}
              />
            )}

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Discount Type</InputLabel>
                <Select value={form.discount_type} label="Discount Type" onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                  <MenuItem value="percent">Percent</MenuItem>
                  <MenuItem value="fixed">Fixed Amount</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Discount Value" type="number" fullWidth value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Valid From" type="date" fullWidth value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField label="Valid To" type="date" fullWidth value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Stack>
            <TextField label="Min Purchase Amount" type="number" fullWidth value={form.min_purchase_amount} onChange={(e) => setForm({ ...form, min_purchase_amount: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.offer_name || !targetIsValid || createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
