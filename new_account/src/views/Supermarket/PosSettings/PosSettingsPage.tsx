import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Stack, Switch, FormControlLabel, Button, Divider, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TuneIcon from "@mui/icons-material/Tune";
import { useNavigate } from "react-router-dom";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { getPosSettings, updatePosSettings } from "../../../api/Pos/posOpsApi";
import { getItemUnits, createItemUnit, updateItemUnit, deleteItemUnit } from "../../../api/ItemUnit/ItemUnitApi";
import { getCardTypes, createCardType, updateCardType, deleteCardType } from "../../../api/CardType/CardTypeApi";
import { notify } from "../../../services/notificationService";

const TOGGLES: { key: string; label: string; helper: string }[] = [
  { key: "low_stock_alerts_on_pos", label: "Low Stock Alerts on POS", helper: "Show a floating panel when items below minimum stock are in the cart" },
  { key: "ask_before_removing_last_item", label: "Ask Before Removing Last Item", helper: "Show a confirmation when staff remove the only line left in the cart" },
  { key: "on_screen_number_pad", label: "On-Screen Number Pad", helper: "For touchscreens/tablets that don't have their own keyboard" },
  { key: "select_customer_at_checkout", label: "Require Customer at Checkout", helper: "Pick a customer or credit before finishing a sale — off for walk-ins" },
  { key: "show_frequently_bought_together", label: "Show \"Frequently Bought Together\"", helper: "Suggest complementary products in the POS cart" },
  { key: "edit_cart_line_total", label: "Allow Editing Cart Line Total", helper: "Staff can type a line's total on the cart (back-calculates unit price)" },
];

const emptyUnitForm = { id: null as number | string | null, abbr: "", name: "", decimals: "0", inactive: false };

export default function PosSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["pos-settings"], queryFn: getPosSettings });
  const [values, setValues] = useState<Record<string, any>>({});
  const [receiptPaperSize, setReceiptPaperSize] = useState("80mm Thermal");
  const [wholesalePin, setWholesalePin] = useState("");
  const [thermalPrinterName, setThermalPrinterName] = useState("EPSON TM-T82 Receipt");

  // Item Units — Add/Edit/Delete the units (KG, PCS, LTR, ...) products are
  // measured in, same list used on Stock's "Apply Unit to Selected" and Set
  // Price's Wholesale Pricing tab. Plain master-data CRUD, no accounting impact.
  const { data: units, isLoading: unitsLoading } = useQuery({ queryKey: ["item-units"], queryFn: () => getItemUnits() });
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [unitForm, setUnitForm] = useState(emptyUnitForm);
  const [confirmDeleteUnitId, setConfirmDeleteUnitId] = useState<number | string | null>(null);

  const openCreateUnit = () => { setUnitForm(emptyUnitForm); setUnitDialogOpen(true); };
  const openEditUnit = (u: any) => {
    setUnitForm({ id: u.id, abbr: u.abbr ?? "", name: u.name ?? "", decimals: String(u.decimals ?? 0), inactive: !!u.inactive });
    setUnitDialogOpen(true);
  };

  const saveUnitMutation = useMutation({
    mutationFn: () => {
      const payload = { abbr: unitForm.abbr.trim(), name: unitForm.name.trim(), decimals: Number(unitForm.decimals) || 0, inactive: unitForm.inactive };
      return unitForm.id ? updateItemUnit(unitForm.id, payload) : createItemUnit(payload);
    },
    onSuccess: () => {
      notify.success(unitForm.id ? "Unit updated" : "Unit created");
      queryClient.invalidateQueries({ queryKey: ["item-units"] });
      setUnitDialogOpen(false);
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save unit"),
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (id: number | string) => deleteItemUnit(id),
    onSuccess: () => {
      notify.success("Unit deleted");
      queryClient.invalidateQueries({ queryKey: ["item-units"] });
      setConfirmDeleteUnitId(null);
    },
    onError: (err: any) => {
      notify.error(err?.response?.data?.message || "Failed to delete unit — it may still be used by a product");
      setConfirmDeleteUnitId(null);
    },
  });

  // Card Types — Add/Edit/Delete the payment card brands (Visa, Mastercard,
  // ...) available to tag at checkout, for reporting on which card brand
  // was used. Plain master-data CRUD, no accounting impact.
  const { data: cardTypes, isLoading: cardTypesLoading } = useQuery({ queryKey: ["card-types"], queryFn: () => getCardTypes() });
  const [cardTypeDialogOpen, setCardTypeDialogOpen] = useState(false);
  const [cardTypeForm, setCardTypeForm] = useState<{ id: number | string | null; name: string }>({ id: null, name: "" });
  const [confirmDeleteCardTypeId, setConfirmDeleteCardTypeId] = useState<number | string | null>(null);

  const openCreateCardType = () => { setCardTypeForm({ id: null, name: "" }); setCardTypeDialogOpen(true); };
  const openEditCardType = (c: any) => { setCardTypeForm({ id: c.id, name: c.name ?? "" }); setCardTypeDialogOpen(true); };

  const saveCardTypeMutation = useMutation({
    mutationFn: () => {
      const payload = { name: cardTypeForm.name.trim() };
      return cardTypeForm.id ? updateCardType(cardTypeForm.id, payload) : createCardType(payload);
    },
    onSuccess: () => {
      notify.success(cardTypeForm.id ? "Card type updated" : "Card type created");
      queryClient.invalidateQueries({ queryKey: ["card-types"] });
      setCardTypeDialogOpen(false);
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save card type"),
  });

  const deleteCardTypeMutation = useMutation({
    mutationFn: (id: number | string) => deleteCardType(id),
    onSuccess: () => {
      notify.success("Card type deleted");
      queryClient.invalidateQueries({ queryKey: ["card-types"] });
      setConfirmDeleteCardTypeId(null);
    },
    onError: (err: any) => {
      notify.error(err?.response?.data?.message || "Failed to delete card type");
      setConfirmDeleteCardTypeId(null);
    },
  });

  useEffect(() => {
    if (data) {
      setValues(data);
      setReceiptPaperSize(data.receipt_paper_size ?? "80mm Thermal");
      setWholesalePin(data.wholesale_pin ?? "");
      setThermalPrinterName(data.thermal_printer_name ?? "EPSON TM-T82 Receipt");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: updatePosSettings,
    onSuccess: () => notify.success("Settings saved"),
  });

  const handleSave = () => {
    saveMutation.mutate({
      ...values,
      receipt_paper_size: receiptPaperSize,
      wholesale_pin: wholesalePin,
      thermal_printer_name: thermalPrinterName,
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="POS Settings" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "POS Settings" }]} />
        </Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </Box>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>While Selling</Typography>
          <Stack spacing={1}>
            {TOGGLES.map((t) => (
              <FormControlLabel
                key={t.key}
                control={
                  <Switch
                    checked={values[t.key] === "1" || values[t.key] === true || values[t.key] === 1}
                    onChange={(e) => setValues({ ...values, [t.key]: e.target.checked })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{t.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.helper}</Typography>
                  </Box>
                }
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Receipt & Billing</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                The receipt logo is always your business logo from Setup → Company Setup — update it there to change every receipt.
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<TuneIcon />} onClick={() => navigate("/supermarket/receipt-customize")}>
              Customize Receipt
            </Button>
          </Stack>
          <Stack spacing={2}>
            <Divider />
            <Typography variant="body2" fontWeight={600}>Default Receipt Paper Size</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {["80mm Thermal", "A5 Sheet", "A4 Sheet", "Computer Sheet"].map((size) => (
                <Button
                  key={size}
                  variant={receiptPaperSize === size ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setReceiptPaperSize(size)}
                >
                  {size}
                </Button>
              ))}
            </Stack>
            <Divider />
            <Typography variant="body2" fontWeight={600}>Thermal Printer Name (Windows)</Typography>
            <Typography variant="caption" color="text.secondary">
              The exact name of the thermal printer as it appears in Windows → Devices and Printers.
              Example: <b>EPSON Coupon Generator(TM-T82)</b>. This must match exactly for printing to work.
            </Typography>
            <TextField
              size="small"
              value={thermalPrinterName}
              onChange={(e) => setThermalPrinterName(e.target.value)}
              placeholder="e.g. EPSON Coupon Generator(TM-T82)"
              sx={{ maxWidth: 400 }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Wholesale Pricing</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            When a cart line's quantity passes a product's Wholesale Qty Threshold (set per product on Set Price),
            the cashier can apply its Wholesale Price at checkout — but only after entering this PIN. It's a single
            shared authorization PIN, not tied to any user login.
          </Typography>
          <TextField
            label="Wholesale Authorization PIN" type="password" size="small" sx={{ width: 260 }}
            value={wholesalePin}
            onChange={(e) => setWholesalePin(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mt: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Item Units</Typography>
              <Typography variant="caption" color="text.secondary">
                The units (KG, PCS, LTR, ...) products are measured in — used across Stock, Set Price, and item setup.
              </Typography>
            </Box>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateUnit}>Add Unit</Button>
          </Stack>

          {unitsLoading ? <PageLoader /> : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Abbreviation</TableCell>
                    <TableCell align="right">Decimal Places</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(units ?? []).map((u: any) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.abbr}</TableCell>
                      <TableCell align="right">{u.decimals}</TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={u.inactive ? "Inactive" : "Active"} color={u.inactive ? "default" : "success"} />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => openEditUnit(u)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setConfirmDeleteUnitId(u.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!units || units.length === 0) && (
                    <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No units yet.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={unitDialogOpen} onClose={() => setUnitDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{unitForm.id ? "Edit Unit" : "Add Unit"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name" size="small" fullWidth
              placeholder="e.g. Kilogram"
              value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
            />
            <TextField
              label="Abbreviation" size="small" fullWidth
              placeholder="e.g. KG"
              value={unitForm.abbr} onChange={(e) => setUnitForm({ ...unitForm, abbr: e.target.value })}
            />
            <TextField
              label="Decimal Places" type="number" size="small" fullWidth
              helperText="0 for whole-count items (pcs), e.g. 2 or 3 for weighed items (kg)"
              value={unitForm.decimals} onChange={(e) => setUnitForm({ ...unitForm, decimals: e.target.value })}
            />
            <FormControlLabel
              control={<Switch checked={unitForm.inactive} onChange={(e) => setUnitForm({ ...unitForm, inactive: e.target.checked })} />}
              label="Inactive"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnitDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!unitForm.name.trim() || !unitForm.abbr.trim() || saveUnitMutation.isPending}
            onClick={() => saveUnitMutation.mutate()}
          >
            {saveUnitMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteUnitId}
        title="Delete this unit?"
        message="Products currently using this unit will keep it until changed — this only removes it from the list for new selections."
        onClose={() => setConfirmDeleteUnitId(null)}
        onConfirm={() => confirmDeleteUnitId != null && deleteUnitMutation.mutate(confirmDeleteUnitId)}
        loading={deleteUnitMutation.isPending}
      />

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mt: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Card Types</Typography>
              <Typography variant="caption" color="text.secondary">
                Payment card brands (Visa, Mastercard, ...) the cashier can tag at checkout — for reporting only,
                doesn't change what's charged.
              </Typography>
            </Box>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateCardType}>Add Card Type</Button>
          </Stack>

          {cardTypesLoading ? <PageLoader /> : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(cardTypes ?? []).map((c: any) => (
                    <TableRow key={c.id} hover>
                      <TableCell>{c.name}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => openEditCardType(c)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setConfirmDeleteCardTypeId(c.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!cardTypes || cardTypes.length === 0) && (
                    <TableRow><TableCell colSpan={2} align="center"><Typography variant="body2">No card types yet.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={cardTypeDialogOpen} onClose={() => setCardTypeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{cardTypeForm.id ? "Edit Card Type" : "Add Card Type"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Name" size="small" fullWidth sx={{ mt: 1 }}
            placeholder="e.g. Visa"
            value={cardTypeForm.name} onChange={(e) => setCardTypeForm({ ...cardTypeForm, name: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCardTypeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!cardTypeForm.name.trim() || saveCardTypeMutation.isPending}
            onClick={() => saveCardTypeMutation.mutate()}
          >
            {saveCardTypeMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteCardTypeId}
        title="Delete this card type?"
        message="Past sales tagged with this card type keep their record — this only removes it from the list for new selections."
        onClose={() => setConfirmDeleteCardTypeId(null)}
        onConfirm={() => confirmDeleteCardTypeId != null && deleteCardTypeMutation.mutate(confirmDeleteCardTypeId)}
        loading={deleteCardTypeMutation.isPending}
      />
    </FormPageLayout>
  );
}
