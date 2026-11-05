import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, Typography, Stack, FormControlLabel, Checkbox, MenuItem,
} from "@mui/material";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getCreditCustomers, setCreditLimit, postOpeningCreditBalance } from "../../../api/Credit/creditApi";
import { getChartMasters } from "../../../api/GLAccounts/ChartMasterApi";
import { notify } from "../../../services/notificationService";

const money = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Equity accounts (Share Capital / Retained Earnings) — the other side of an opening balance.
const EQUITY_TYPES = [5, 6];
const DEFAULT_OPENING_ACCOUNT = "1330";

// Registered customers who buy on credit: set their credit limit and enter
// what they already owed before the system (opening credit balance).
export default function CreditCustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyCredit, setOnlyCredit] = useState(true);
  const [limitFor, setLimitFor] = useState<any>(null);
  const [limitValue, setLimitValue] = useState("");
  const [openingFor, setOpeningFor] = useState<any>(null);
  const [opening, setOpening] = useState({ amount: "", tran_date: today(), credit_account: DEFAULT_OPENING_ACCOUNT, memo: "" });

  const { data: customers, isLoading } = useQuery({ queryKey: ["credit-customers"], queryFn: getCreditCustomers });
  const { data: accounts } = useQuery({ queryKey: ["chart-masters"], queryFn: getChartMasters });
  const equityAccounts = useMemo(
    () => (accounts ?? []).filter((a: any) => EQUITY_TYPES.includes(Number(a.account_type?.id ?? a.account_type))),
    [accounts]
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["credit-customers"] });
    queryClient.invalidateQueries({ queryKey: ["credit-open-bills"] });
    queryClient.invalidateQueries({ queryKey: ["customer-credit"] });
  };

  const limitMutation = useMutation({
    mutationFn: () => setCreditLimit(limitFor.debtor_no, Number(limitValue) || 0),
    onSuccess: () => { notify.success(`Credit limit saved for ${limitFor?.name}`); setLimitFor(null); refresh(); },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save credit limit"),
  });

  const openingMutation = useMutation({
    mutationFn: () => postOpeningCreditBalance(openingFor.debtor_no, {
      amount: Number(opening.amount),
      tran_date: opening.tran_date,
      credit_account: opening.credit_account,
      memo: opening.memo || undefined,
    }),
    onSuccess: () => { notify.success(`Opening credit balance saved for ${openingFor?.name}`); setOpeningFor(null); refresh(); },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save opening balance"),
  });

  const filtered = (customers ?? []).filter((c: any) => {
    if (onlyCredit && !(Number(c.credit_limit) > 0 || Math.abs(Number(c.outstanding)) > 0.005)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name?.toLowerCase().includes(s) || String(c.mobile ?? "").includes(s);
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Credit Customers" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Credit Customers" }]} />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Customers who buy on credit. Set a credit limit (0 = no limit) and enter the opening balance for a customer who already owed money before the system.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
        <TextField size="small" fullWidth placeholder="Search by name or phone number..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <FormControlLabel
          sx={{ whiteSpace: "nowrap" }}
          control={<Checkbox checked={onlyCredit} onChange={(e) => setOnlyCredit(e.target.checked)} />}
          label="Only credit customers"
        />
      </Stack>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Phone Number</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Credit Limit</TableCell>
                <TableCell align="right">Owes</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.debtor_no} hover>
                  <TableCell>{c.mobile || "—"}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell align="right">{Number(c.credit_limit) > 0 ? money(c.credit_limit) : "No limit"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: Number(c.outstanding) > 0.005 ? "error.main" : undefined }}>
                    {money(c.outstanding)}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button size="small" variant="outlined" onClick={() => { setLimitFor(c); setLimitValue(String(Number(c.credit_limit) || "")); }}>
                        Credit Limit
                      </Button>
                      <Button size="small" variant="outlined" color="secondary" onClick={() => { setOpeningFor(c); setOpening({ amount: "", tran_date: today(), credit_account: DEFAULT_OPENING_ACCOUNT, memo: "" }); }}>
                        Opening Balance
                      </Button>
                      <Button size="small" variant="contained" disabled={!(Number(c.outstanding) > 0.005)} onClick={() => navigate(`/supermarket/credit-payments?debtor=${c.debtor_no}`)}>
                        Receive Payment
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2">{onlyCredit ? "No credit customers yet — untick \"Only credit customers\" to find a customer." : "No customers."}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!limitFor} onClose={() => setLimitFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Credit Limit — {limitFor?.name}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth size="small" sx={{ mt: 1 }} type="number" label="Credit limit (LKR)"
            helperText="0 = no limit. A credit sale is blocked if it takes the customer over this amount."
            value={limitValue} onChange={(e) => setLimitValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLimitFor(null)}>Cancel</Button>
          <Button variant="contained" disabled={limitMutation.isPending || Number(limitValue) < 0} onClick={() => limitMutation.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!openingFor} onClose={() => setOpeningFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Opening Credit Balance — {openingFor?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            What this customer already owed before the system. Saved as a journal entry: Trade Debtors (this customer) is debited, the account below is credited.
          </Typography>
          <Stack spacing={2}>
            <TextField autoFocus size="small" type="number" label="Amount owed (LKR)" value={opening.amount} onChange={(e) => setOpening({ ...opening, amount: e.target.value })} />
            <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={opening.tran_date} onChange={(e) => setOpening({ ...opening, tran_date: e.target.value })} />
            <TextField select size="small" label="Credit account" value={opening.credit_account} onChange={(e) => setOpening({ ...opening, credit_account: e.target.value })}>
              {equityAccounts.map((a: any) => (
                <MenuItem key={a.account_code} value={a.account_code}>{a.account_code} — {a.account_name}</MenuItem>
              ))}
            </TextField>
            <TextField size="small" label="Note (optional)" value={opening.memo} onChange={(e) => setOpening({ ...opening, memo: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpeningFor(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={openingMutation.isPending || !(Number(opening.amount) > 0) || !opening.credit_account}
            onClick={() => openingMutation.mutate()}
          >
            Save Opening Balance
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
