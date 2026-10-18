import { useLayoutEffect, useRef, useState } from "react";

/** "56000.5" → "56,000.5" — keeps whatever decimals the user has typed so far. */
const addThousandSeparators = (raw: string) => {
  if (!raw) return raw;
  const [intPart, decimals] = raw.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals !== undefined ? `${withCommas}.${decimals}` : withCommas;
};
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, IconButton,
  Tooltip, Divider, MenuItem, Select, FormControl, InputLabel, InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../../../api/Supplier/SupplierApi";
import { getPaymentTerms } from "../../../api/PaymentTerm/PaymentTermApi";
import { notify } from "../../../services/notificationService";

const emptyForm = {
  supp_name: "",
  contact: "",
  mail_address: "",
  credit_limit: "",
  payment_terms: "",
  bank_name: "",
  bank_branch: "",
  bank_acc_no: "",
};

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creditLimitFocused, setCreditLimitFocused] = useState(false);
  const creditLimitInputRef = useRef<HTMLInputElement>(null);
  const pendingCreditCaret = useRef<number | null>(null);

  // Put the cursor back after the same digit once commas have been re-inserted.
  useLayoutEffect(() => {
    const el = creditLimitInputRef.current;
    const target = pendingCreditCaret.current;
    if (!el || target == null) return;
    pendingCreditCaret.current = null;
    let count = 0;
    let pos = 0;
    while (pos < el.value.length && count < target) {
      if (el.value[pos] !== ",") count++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  }, [form.credit_limit]);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  const { data: suppliers, isLoading } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers });
  const { data: paymentTerms } = useQuery({ queryKey: ["payment-terms"], queryFn: getPaymentTerms });

  const buildPayload = () => {
    const parts = [form.bank_name.trim(), form.bank_branch.trim(), form.bank_acc_no.trim()].filter(Boolean);
    return {
      supp_name: form.supp_name.trim(),
      supp_short_name: form.supp_name.trim().slice(0, 30),
      contact: form.contact.trim(),
      mail_address: form.mail_address.trim(),
      credit_limit: form.credit_limit !== "" ? Number(form.credit_limit) : 0,
      payment_terms: form.payment_terms !== "" ? Number(form.payment_terms) : undefined,
      bank_account: parts.join(" — "),
    };
  };

  const createMutation = useMutation({
    mutationFn: () => createSupplier(buildPayload()),
    onSuccess: () => {
      notify.success("Supplier added");
      queryClient.invalidateQueries({ queryKey: ["suppliers-all"] });
      closeDialog();
    },
    onError: () => notify.error("Failed to add supplier"),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateSupplier(editingSupplier.supplier_id, { ...editingSupplier, ...buildPayload() }),
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
    setForm({
      supp_name: s.supp_name ?? "",
      contact: s.contact ?? "",
      mail_address: s.mail_address ?? "",
      credit_limit: s.credit_limit != null ? String(s.credit_limit) : "",
      payment_terms: s.payment_terms != null ? String(s.payment_terms) : "",
      bank_name: (s.bank_account ?? "").split(" — ")[0] ?? "",
      bank_branch: (s.bank_account ?? "").split(" — ")[1] ?? "",
      bank_acc_no: (s.bank_account ?? "").split(" — ")[2] ?? "",
    });
    setOpen(true);
  };

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));
  const isPending = createMutation.isPending || updateMutation.isPending;

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
                <TableCell>Address</TableCell>
                <TableCell>Credit Limit</TableCell>
                <TableCell>Payment Terms</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(suppliers ?? []).map((s: any) => (
                <TableRow key={s.supplier_id} hover>
                  <TableCell>{s.supp_name}</TableCell>
                  <TableCell>{s.contact || "—"}</TableCell>
                  <TableCell>{s.mail_address || "—"}</TableCell>
                  <TableCell>{s.credit_limit != null ? `LKR ${Number(s.credit_limit).toLocaleString()}` : "—"}</TableCell>
                  <TableCell>
                    {(paymentTerms ?? []).find((t: any) => t.terms_indicator === s.payment_terms)?.description || (s.payment_terms ? s.payment_terms : "—")}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit Supplier">
                      <IconButton size="small" onClick={() => openEditDialog(s)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(s.supplier_id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!suppliers || suppliers.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No suppliers yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Supplier Name *" fullWidth autoFocus value={form.supp_name} onChange={(e) => set("supp_name", e.target.value)} />
            <TextField label="Telephone / Mobile" fullWidth value={form.contact} onChange={(e) => set("contact", e.target.value)} />
            <TextField label="Address" fullWidth multiline rows={2} value={form.mail_address} onChange={(e) => set("mail_address", e.target.value)} />

            <Divider><Typography variant="caption" color="text.secondary">Financial</Typography></Divider>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Credit Limit" fullWidth
                // Commas while typing (56,000); ".00" only once the box loses focus,
                // otherwise ".00" gets appended mid-typing and the next digit lands after it.
                value={
                  !creditLimitFocused && form.credit_limit !== "" && !isNaN(Number(form.credit_limit))
                    ? Number(form.credit_limit).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : addThousandSeparators(form.credit_limit)
                }
                inputRef={creditLimitInputRef}
                onChange={(e) => {
                  const el = e.target;
                  const caret = el.selectionStart ?? el.value.length;
                  let raw = el.value.replace(/,/g, "");
                  // Remember how many real characters sit before the cursor, so it can be
                  // put back in the same place after commas are re-inserted.
                  let caretChars = el.value.slice(0, caret).replace(/,/g, "").length;
                  // Backspace/Delete on a comma only removed the comma (which would just
                  // come back) — remove the digit next to it instead.
                  if (raw === form.credit_limit && el.value.length < addThousandSeparators(raw).length) {
                    const forward = (e.nativeEvent as InputEvent).inputType === "deleteContentForward";
                    if (forward) {
                      raw = raw.slice(0, caretChars) + raw.slice(caretChars + 1);
                    } else if (caretChars > 0) {
                      raw = raw.slice(0, caretChars - 1) + raw.slice(caretChars);
                      caretChars -= 1;
                    }
                  }
                  if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
                  pendingCreditCaret.current = caretChars;
                  set("credit_limit", raw);
                }}
                onFocus={(e) => { setCreditLimitFocused(true); const input = e.target; setTimeout(() => input.select(), 0); }}
                onBlur={() => setCreditLimitFocused(false)}
                inputProps={{ inputMode: "decimal" }}
                InputProps={{ startAdornment: <InputAdornment position="start">LKR</InputAdornment> }}
              />
              <FormControl fullWidth>
                <InputLabel>Payment Terms</InputLabel>
                <Select label="Payment Terms" value={form.payment_terms} onChange={(e) => set("payment_terms", String(e.target.value))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {(paymentTerms ?? []).map((t: any) => (
                    <MenuItem key={t.terms_indicator} value={t.terms_indicator}>{t.description}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Divider><Typography variant="caption" color="text.secondary">Bank Details</Typography></Divider>

            <TextField label="Bank Name" fullWidth value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="e.g. Bank of Ceylon" />
            <TextField label="Branch Name" fullWidth value={form.bank_branch} onChange={(e) => set("bank_branch", e.target.value)} placeholder="e.g. Kandy Branch" />
            <TextField label="Account No" fullWidth value={form.bank_acc_no} onChange={(e) => set("bank_acc_no", e.target.value)} placeholder="e.g. 0123456789" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" disabled={!form.supp_name.trim() || isPending} onClick={() => editingSupplier ? updateMutation.mutate() : createMutation.mutate()}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
