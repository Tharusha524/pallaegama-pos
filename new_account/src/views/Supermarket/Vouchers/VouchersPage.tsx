import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete, Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getVouchers, createVoucher } from "../../../api/Pos/posOpsApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

const DENOMINATIONS = [1000, 2500, 5000, 10000];

export default function VouchersPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [faceValue, setFaceValue] = useState("1000");
  const [expiryDate, setExpiryDate] = useState("");
  const [note, setNote] = useState("");

  const { data: vouchers, isLoading } = useQuery({ queryKey: ["vouchers"], queryFn: getVouchers });
  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });

  const createMutation = useMutation({
    mutationFn: createVoucher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      setOpen(false);
      setCustomer(null); setFaceValue("1000"); setExpiryDate(""); setNote("");
    },
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Vouchers & Gift Cards" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Vouchers" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Issue Voucher</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Code</TableCell><TableCell>Customer</TableCell><TableCell align="right">Face Value</TableCell>
                <TableCell align="right">Balance</TableCell><TableCell>Issued</TableCell><TableCell>Expiry</TableCell><TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(vouchers ?? []).map((v: any) => (
                <TableRow key={v.id} hover>
                  <TableCell>{v.voucher_code}</TableCell>
                  <TableCell>{v.debtor?.name ?? "—"}</TableCell>
                  <TableCell align="right">{formatCurrency(v.face_value)}</TableCell>
                  <TableCell align="right">{formatCurrency(v.balance)}</TableCell>
                  <TableCell>{String(v.issue_date).slice(0, 10)}</TableCell>
                  <TableCell>{v.expiry_date ? String(v.expiry_date).slice(0, 10) : "—"}</TableCell>
                  <TableCell align="center"><Chip label={v.status} size="small" color={v.status === "active" ? "success" : "default"} /></TableCell>
                </TableRow>
              ))}
              {(!vouchers || vouchers.length === 0) && (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2">No vouchers issued yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Issue Voucher</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={customers ?? []}
              getOptionLabel={(c: any) => c.name ?? ""}
              value={customer}
              onChange={(_, val) => setCustomer(val)}
              renderInput={(params) => <TextField {...params} label="Customer (optional)" />}
            />
            <Stack direction="row" spacing={1}>
              {DENOMINATIONS.map((d) => (
                <Chip key={d} label={formatCurrency(d)} clickable color={Number(faceValue) === d ? "primary" : "default"} onClick={() => setFaceValue(String(d))} />
              ))}
            </Stack>
            <TextField label="Face Value" type="number" fullWidth value={faceValue} onChange={(e) => setFaceValue(e.target.value)} />
            <TextField label="Expiry Date (optional)" type="date" fullWidth value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Note" fullWidth value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gift for VIP customer" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained" disabled={createMutation.isPending || Number(faceValue) <= 0}
            onClick={() => createMutation.mutate({ debtor_no: customer?.debtor_no, face_value: Number(faceValue), expiry_date: expiryDate || undefined, note })}
          >
            {createMutation.isPending ? "Issuing..." : "Issue Voucher"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
