import { useEffect, useState } from "react";
import { toSinhalaSearch } from "../../../utils/singlishSearch";

/** Today's date (YYYY-MM-DD) in the PC's own time zone, not UTC. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Products search: name, stock ID — plus Singlish ("kakar" → "කැකර්").
const filterOfferProducts = (options: any[], { inputValue }: { inputValue: string }) => {
  const term = inputValue.trim().toLowerCase();
  if (!term) return options;
  const sinhala = toSinhalaSearch(inputValue);
  return options.filter((i: any) => {
    const name = String(i.description ?? "").toLowerCase();
    return name.includes(term)
      || String(i.stock_id ?? "").toLowerCase().includes(term)
      || (!!sinhala && name.includes(sinhala));
  });
};
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, IconButton, Typography,
  FormControl, InputLabel, Select, MenuItem, Chip, Autocomplete, Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ImageIcon from "@mui/icons-material/Image";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getOffers, createOffer, updateOffer, deleteOffer, getOfferPopularity, type OfferInput } from "../../../api/Loyalty/loyaltyApi";
import { getLoyaltyTiers } from "../../../api/Loyalty/loyaltyApi";
import { getItems } from "../../../api/Item/ItemApi";
import { getItemCategories } from "../../../api/ItemCategories/ItemCategoriesApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

const emptyForm = {
  offer_name: "", offer_type: "product", discount_type: "percent",
  discount_value: "10", valid_from: new Date().toISOString().slice(0, 10),
  valid_to: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  min_purchase_amount: "0",
};

export default function OffersPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => () => { if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

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
  const revenueMap = new Map<number, number>((popularity ?? []).map((p: any) => [p.offer_id, Number(p.total_revenue ?? 0)]));

  const closeDialog = () => {
    setOpen(false);
    setEditingOffer(null);
    setForm(emptyForm);
    setSelectedProducts([]);
    setSelectedCategory(null);
    setSelectedTier(null);
    setSelectedCustomer(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
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

    setImageFile(null);
    setImagePreview(offer.image_url ?? null);
    setRemoveImage(false);
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
    const payload: any = {
      ...form,
      target_id: resolveTargetId(),
      discount_value: Number(form.discount_value) || 0,
      min_purchase_amount: Number(form.min_purchase_amount) || 0,
      image: imageFile,
      remove_image: removeImage,
    };
    if (editingOffer) {
      updateMutation.mutate({ id: editingOffer.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const targetIsValid =
    (form.offer_type === "product" && selectedProducts.length > 0) ||
    (form.offer_type === "category" && !!selectedCategory) ||
    (form.offer_type === "tier" && !!selectedTier) ||
    (form.offer_type === "customer" && !!selectedCustomer) ||
    form.offer_type === "birthday"; // no target to pick — applies to whoever's birthday it is

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
                <TableCell>Image</TableCell>
                <TableCell>Offer Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Target</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell>Valid Period</TableCell>
                <TableCell align="center">Redemptions</TableCell>
                <TableCell align="right">Revenue Generated</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(offers ?? []).map((offer: any) => (
                <TableRow key={offer.id} hover>
                  <TableCell>
                    {offer.image_url
                      ? <img src={offer.image_url} alt="" style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 4, display: "block" }} />
                      : <Box sx={{ width: 56, height: 40, borderRadius: 1, bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center" }}><ImageIcon sx={{ color: "grey.400", fontSize: 20 }} /></Box>}
                  </TableCell>
                  <TableCell>{offer.offer_name}</TableCell>
                  <TableCell>{offer.offer_type}</TableCell>
                  <TableCell>{displayTarget(offer)}</TableCell>
                  <TableCell align="right">
                    {offer.discount_type === "percent" ? `${offer.discount_value}%` : offer.discount_value}
                  </TableCell>
                  <TableCell>{String(offer.valid_from).slice(0, 10)} – {String(offer.valid_to).slice(0, 10)}</TableCell>
                  <TableCell align="center">{popularityMap.get(offer.id) ?? 0}</TableCell>
                  <TableCell align="right">{formatCurrency(revenueMap.get(offer.id) ?? 0)}</TableCell>
                  <TableCell align="center">
                    {(() => {
                      // "active" is a manual switch; past its end date the offer no longer applies.
                      const isExpired = offer.status === "active" && String(offer.valid_to).slice(0, 10) < localToday();
                      return isExpired
                        ? <Chip label="expired" size="small" color="error" variant="outlined" />
                        : <Chip label={offer.status} size="small" color={offer.status === "active" ? "success" : "default"} />;
                    })()}
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
                <TableRow><TableCell colSpan={10} align="center"><Typography variant="body2">No offers configured yet.</Typography></TableCell></TableRow>
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
                <MenuItem value="birthday">Birthday (any customer, on their birthday)</MenuItem>
              </Select>
            </FormControl>

            {form.offer_type === "product" && (
              <Autocomplete
                multiple
                options={items ?? []}
                getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
                filterOptions={filterOfferProducts}
                isOptionEqualToValue={(a: any, b: any) => String(a?.stock_id) === String(b?.stock_id)}
                renderOption={(props, option: any) => (
                  <li {...props} key={option.stock_id}>
                    <Typography variant="body2">
                      {option.description}{" "}
                      <Typography component="span" variant="caption" color="text.secondary">({option.stock_id})</Typography>
                    </Typography>
                  </li>
                )}
                value={selectedProducts}
                onChange={(_, val) => setSelectedProducts(val)}
                renderInput={(params) => <TextField {...params} label="Products" placeholder="Search by name or stock ID" />}
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

            {/* Image upload for mobile app display */}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Promotion Image (shown in mobile app)</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button component="label" variant="outlined" size="small" startIcon={<PhotoCameraIcon />}>
                  {imagePreview ? "Change Image" : "Upload Image"}
                  <input hidden type="file" accept="image/*" onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = ""; }} />
                </Button>
                {imagePreview && (
                  <Button size="small" color="error" onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setRemoveImage(!!editingOffer?.image_url);
                  }}>Remove</Button>
                )}
              </Stack>
              {imagePreview && (
                <Box sx={{ mt: 1 }}>
                  <img src={imagePreview} alt="preview" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 6, objectFit: "cover" }} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary">JPG/PNG up to 5MB. Wide images look best.</Typography>
            </Box>
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
