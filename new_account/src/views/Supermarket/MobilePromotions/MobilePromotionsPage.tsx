import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, IconButton, Typography,
  FormControl, InputLabel, Select, MenuItem, Chip, Switch, FormControlLabel, Tooltip, ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SmsIcon from "@mui/icons-material/Sms";
import ImageIcon from "@mui/icons-material/Image";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { notify } from "../../../services/notificationService";
import {
  getMobilePromotions, createMobilePromotion, updateMobilePromotion, deleteMobilePromotion,
  getSmsRecipientCount, sendMobilePromotionSms,
  type MobilePromotion, type MobilePromotionInput, type PromoType,
} from "../../../api/MobilePromotion/mobilePromotionApi";

const TYPE_LABEL: Record<PromoType, string> = { promotion: "Promotion", offer: "Offer", discount: "Discount" };
const TYPE_COLOR: Record<PromoType, "primary" | "secondary" | "success"> = {
  promotion: "primary", offer: "secondary", discount: "success",
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): MobilePromotionInput => ({
  title: "", description: "", promo_type: "promotion",
  discount_type: null, discount_value: "",
  valid_from: today(),
  valid_to: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  is_active: true, sort_order: "0", image: null, remove_image: false,
});

function statusOf(p: MobilePromotion): { label: string; color: "success" | "warning" | "default" | "error" } {
  const t = today();
  if (!p.is_active) return { label: "Hidden", color: "default" };
  if (p.valid_from > t) return { label: "Scheduled", color: "warning" };
  if (p.valid_to < t) return { label: "Expired", color: "error" };
  return { label: "Live on app", color: "success" };
}

function discountText(p: { discount_type: string | null; discount_value: number | string | null }) {
  if (!p.discount_type || p.discount_value === null || p.discount_value === "") return "";
  const v = Number(p.discount_value);
  return p.discount_type === "percent" ? `${v}% OFF` : `Rs. ${v.toFixed(2)} OFF`;
}

// How the customer will see it in the mobile app.
function MobileCardPreview({ form, imageSrc }: { form: MobilePromotionInput; imageSrc: string | null }) {
  const disc = discountText({ discount_type: form.discount_type, discount_value: form.discount_value });
  return (
    <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden", width: "100%", maxWidth: 300, mx: "auto" }}>
      <Box sx={{ position: "relative", height: 150, bgcolor: "grey.200", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {imageSrc
          ? <img src={imageSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <ImageIcon sx={{ fontSize: 48, color: "grey.400" }} />}
        {disc && (
          <Chip label={disc} color="error" size="small" sx={{ position: "absolute", top: 8, right: 8, fontWeight: 700 }} />
        )}
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Chip label={TYPE_LABEL[form.promo_type]} color={TYPE_COLOR[form.promo_type]} size="small" sx={{ mb: 0.5 }} />
        <Typography fontWeight={700} sx={{ wordBreak: "break-word" }}>{form.title || "Promotion title"}</Typography>
        {form.description && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {form.description}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">Valid till {form.valid_to}</Typography>
      </Box>
    </Paper>
  );
}

export default function MobilePromotionsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MobilePromotion | null>(null);
  const [form, setForm] = useState<MobilePromotionInput>(emptyForm());
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<MobilePromotion | null>(null);
  const [smsTarget, setSmsTarget] = useState<MobilePromotion | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [filter, setFilter] = useState<"all" | PromoType>("all");

  const { data: promotions, isLoading } = useQuery({ queryKey: ["mobile-promotions"], queryFn: getMobilePromotions });
  const { data: recipientCount } = useQuery({
    queryKey: ["mobile-promotions-sms-count"],
    queryFn: getSmsRecipientCount,
    enabled: !!smsTarget,
  });

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const filtered = useMemo(
    () => (promotions ?? []).filter((p) => filter === "all" || p.promo_type === filter),
    [promotions, filter]
  );

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setLocalPreview(null);
  };

  const saveMutation = useMutation({
    mutationFn: () => (editing ? updateMobilePromotion(editing.id, form) : createMobilePromotion(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-promotions"] });
      notify.success(editing ? "Promotion updated" : "Promotion created");
      closeDialog();
    },
    onError: (e: any) => notify.error(e?.response?.data?.message ?? "Failed to save promotion"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMobilePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-promotions"] });
      notify.success("Promotion deleted");
      setToDelete(null);
    },
    onError: () => notify.error("Failed to delete promotion"),
  });

  const smsMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) => sendMobilePromotionSms(id, message || undefined),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["mobile-promotions"] });
      if (r.failed > 0) notify.error(`SMS sent to ${r.sent} of ${r.total} customers (${r.failed} failed)`);
      else notify.success(`SMS sent to ${r.sent} customers`);
      setSmsTarget(null);
    },
    onError: (e: any) => notify.error(e?.response?.data?.message ?? "Failed to send SMS"),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setLocalPreview(null);
    setOpen(true);
  };

  const openEdit = (p: MobilePromotion) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      promo_type: p.promo_type,
      discount_type: p.discount_type,
      discount_value: p.discount_value !== null ? String(p.discount_value) : "",
      valid_from: String(p.valid_from).slice(0, 10),
      valid_to: String(p.valid_to).slice(0, 10),
      is_active: p.is_active,
      sort_order: String(p.sort_order ?? 0),
      image: null,
      remove_image: false,
    });
    setLocalPreview(null);
    setOpen(true);
  };

  const openSms = (p: MobilePromotion) => {
    const disc = discountText(p);
    setSmsMessage(`${p.title}${disc ? ` - ${disc}` : ""} - Valid till ${String(p.valid_to).slice(0, 10)}. Visit us today!`);
    setSmsTarget(p);
  };

  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { notify.error("Image must be 5MB or smaller"); return; }
    setForm((f) => ({ ...f, image: file, remove_image: false }));
    setLocalPreview(URL.createObjectURL(file));
  };

  const previewSrc = localPreview ?? (form.remove_image ? null : editing?.image_url ?? null);
  const dateError = form.valid_to < form.valid_from;
  const canSave = form.title.trim() !== "" && !dateError && !saveMutation.isPending;

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <PageTitle title="Promotions (Mobile App)" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Promotions" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Promotion</Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Promotions, offers and discounts shown to customers in the mobile app. These are for display only and do not change POS prices.
      </Typography>

      <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)} sx={{ mb: 1.5 }}>
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="promotion">Promotions</ToggleButton>
        <ToggleButton value="offer">Offers</ToggleButton>
        <ToggleButton value="discount">Discounts</ToggleButton>
      </ToggleButtonGroup>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Image</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell>Valid Period</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">SMS</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const st = statusOf(p);
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      {p.image_url
                        ? <img src={p.image_url} alt="" style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 6, display: "block" }} />
                        : <Box sx={{ width: 64, height: 44, borderRadius: 1.5, bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center" }}><ImageIcon sx={{ color: "grey.400" }} /></Box>}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600} variant="body2">{p.title}</Typography>
                      {p.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell><Chip size="small" label={TYPE_LABEL[p.promo_type]} color={TYPE_COLOR[p.promo_type]} variant="outlined" /></TableCell>
                    <TableCell align="right">{discountText(p) || "—"}</TableCell>
                    <TableCell>{String(p.valid_from).slice(0, 10)} – {String(p.valid_to).slice(0, 10)}</TableCell>
                    <TableCell align="center"><Chip size="small" label={st.label} color={st.color} /></TableCell>
                    <TableCell align="center">
                      {p.sms_sent_at
                        ? <Tooltip title={`Last sent ${new Date(p.sms_sent_at).toLocaleString()}`}><Typography variant="caption">{p.sms_sent_count} sent</Typography></Tooltip>
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="Send as SMS (optional)">
                        <IconButton size="small" color="primary" onClick={() => openSms(p)}><SmsIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setToDelete(p)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2" sx={{ py: 2 }}>No promotions yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add / Edit */}
      <Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? "Edit Promotion" : "Add Promotion"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 300px" }, gap: 3, mt: 1 }}>
            <Stack spacing={2}>
              <TextField label="Title" fullWidth required value={form.title} inputProps={{ maxLength: 255 }}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <TextField label="Description" fullWidth multiline minRows={3} value={form.description} inputProps={{ maxLength: 2000 }}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={form.promo_type} label="Type" onChange={(e) => setForm({ ...form, promo_type: e.target.value as PromoType })}>
                  <MenuItem value="promotion">Promotion</MenuItem>
                  <MenuItem value="offer">Offer</MenuItem>
                  <MenuItem value="discount">Discount</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Discount</InputLabel>
                  <Select
                    value={form.discount_type ?? "none"}
                    label="Discount"
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, discount_type: v === "none" ? null : (v as "percent" | "fixed"), discount_value: v === "none" ? "" : form.discount_value });
                    }}
                  >
                    <MenuItem value="none">No discount badge</MenuItem>
                    <MenuItem value="percent">Percent (%)</MenuItem>
                    <MenuItem value="fixed">Fixed amount (Rs.)</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Discount Value" type="number" fullWidth disabled={!form.discount_type}
                  value={form.discount_value} inputProps={{ min: 0, step: "0.01" }}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="Valid From" type="date" fullWidth value={form.valid_from} InputLabelProps={{ shrink: true }}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                <TextField label="Valid To" type="date" fullWidth value={form.valid_to} InputLabelProps={{ shrink: true }}
                  error={dateError} helperText={dateError ? "Must be on or after Valid From" : ""}
                  onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField label="Display Order" type="number" sx={{ width: 160 }} value={form.sort_order}
                  inputProps={{ min: 0 }} helperText="Lower shows first"
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                <FormControlLabel
                  control={<Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
                  label="Show in mobile app"
                />
              </Stack>
            </Stack>

            <Stack spacing={1.5}>
              <Typography variant="subtitle2">Image</Typography>
              <Stack direction="row" spacing={1}>
                <Button component="label" variant="outlined" size="small" startIcon={<PhotoCameraIcon />}>
                  {previewSrc ? "Change Image" : "Upload Image"}
                  <input hidden type="file" accept="image/*" onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = ""; }} />
                </Button>
                {previewSrc && (
                  <Button size="small" color="error" onClick={() => {
                    setLocalPreview(null);
                    setForm((f) => ({ ...f, image: null, remove_image: !!editing?.image_url }));
                  }}>Remove</Button>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">JPG/PNG up to 5MB. Wide images (e.g. 1200×600) look best.</Typography>
              <Typography variant="subtitle2" sx={{ pt: 1 }}>Mobile app preview</Typography>
              <MobileCardPreview form={form} imageSrc={previewSrc} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete promotion?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">"{toDelete?.title}" will be removed from the mobile app. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleteMutation.isPending}
            onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SMS confirm */}
      <Dialog open={!!smsTarget} onClose={() => !smsMutation.isPending && setSmsTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Send promotion as SMS</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              This will send an SMS to <b>{recipientCount ?? "…"}</b> customers with a mobile number, using the Notify.lk gateway. SMS charges apply per message.
            </Typography>
            <TextField label="Message" fullWidth multiline minRows={3} value={smsMessage}
              inputProps={{ maxLength: 480 }} helperText={`${smsMessage.length}/480 characters`}
              onChange={(e) => setSmsMessage(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSmsTarget(null)} disabled={smsMutation.isPending}>Cancel</Button>
          <Button variant="contained" startIcon={<SmsIcon />}
            disabled={smsMutation.isPending || !smsMessage.trim() || !recipientCount}
            onClick={() => smsTarget && smsMutation.mutate({ id: smsTarget.id, message: smsMessage.trim() })}>
            {smsMutation.isPending ? "Sending..." : "Send SMS"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
