import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, TextField, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Typography, Stack, Autocomplete, MenuItem, Card, CardContent, Grid,
} from "@mui/material";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getCreditCustomers, getCreditOpenBills } from "../../../api/Credit/creditApi";
import { getBankAccounts } from "../../../api/BankAccount/BankAccountApi";
import { createCustomerPayment } from "../../../api/SalesPayment/SalesPaymentApi";
import { notify } from "../../../services/notificationService";

const money = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Receive money from a credit customer. Uses the ERP's normal customer
// payment (Sales -> Customer Payments) and allocates it to the unpaid credit
// bills, oldest first. Anything above the bills pays off the opening balance.
export default function CreditPaymentsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [customer, setCustomer] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [tranDate, setTranDate] = useState(today());
  const [comments, setComments] = useState("");

  const { data: customers } = useQuery({ queryKey: ["credit-customers"], queryFn: getCreditCustomers });
  const { data: bankAccounts } = useQuery({ queryKey: ["bankAccounts"], queryFn: getBankAccounts });
  const { data: open, isFetching } = useQuery({
    queryKey: ["credit-open-bills", customer?.debtor_no],
    queryFn: () => getCreditOpenBills(customer.debtor_no),
    enabled: !!customer,
  });

  const owingCustomers = useMemo(() => (customers ?? []).filter((c: any) => Number(c.outstanding) > 0.005), [customers]);

  // Coming from Credit Customers -> "Receive Payment".
  useEffect(() => {
    const d = searchParams.get("debtor");
    if (d && customers && !customer) {
      const found = customers.find((c: any) => String(c.debtor_no) === d);
      if (found) setCustomer(found);
    }
  }, [customers, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default to the cash account.
  useEffect(() => {
    if (bankAccountId === "" && bankAccounts?.length) {
      const cash = bankAccounts.find((a: any) => Number(a.account_type?.id ?? a.account_type) === 4) ?? bankAccounts[0];
      setBankAccountId(cash.id);
    }
  }, [bankAccounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const owes = Number(open?.summary?.outstanding_balance ?? 0);
  const bills: any[] = open?.bills ?? [];
  const paid = Number(amount) || 0;

  // The amount goes to the oldest bill first — the bills table beside this
  // form is there to look at, not to pick from.
  const allocations = useMemo(() => {
    let left = paid;
    const out: { trans_no_to: number; trans_type_to: number; amt: number }[] = [];
    for (const b of bills) {
      if (left <= 0.005) break;
      const amt = Math.min(left, Number(b.owing));
      out.push({ trans_no_to: Number(b.trans_no), trans_type_to: 10, amt: Number(amt.toFixed(2)) });
      left = Number((left - amt).toFixed(2));
    }
    return out;
  }, [bills, paid]);

  const payMutation = useMutation({
    mutationFn: () => createCustomerPayment({
      debtor_no: Number(customer.debtor_no),
      branch_code: Number(customer.branch_code),
      tran_date: tranDate,
      bank_account_id: Number(bankAccountId),
      amount: Number(paid.toFixed(2)),
      comments: comments || `Credit payment - ${customer.name}`,
      allocations,
    }),
    onSuccess: () => {
      notify.success(`Payment of LKR ${money(paid)} received from ${customer.name}`);
      setAmount("");
      setComments("");
      queryClient.invalidateQueries({ queryKey: ["credit-customers"] });
      queryClient.invalidateQueries({ queryKey: ["credit-open-bills"] });
      queryClient.invalidateQueries({ queryKey: ["customer-credit"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to save payment"),
  });

  const canSave = !!customer && !!customer.branch_code && bankAccountId !== "" && paid > 0
    && paid <= owes + 0.01 && !payMutation.isPending;

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Credit Payments" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Credit Payments" }]} />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card elevation={2}>
            <CardContent>
              <Stack spacing={2}>
                <Autocomplete
                  options={owingCustomers}
                  value={customer}
                  onChange={(_, v) => { setCustomer(v); setAmount(""); }}
                  getOptionLabel={(c: any) => `${c.name}${c.mobile ? ` — ${c.mobile}` : ""}`}
                  isOptionEqualToValue={(a: any, b: any) => a.debtor_no === b.debtor_no}
                  renderOption={(props, c: any) => (
                    <li {...props} key={c.debtor_no}>
                      <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                        <span>{c.name}{c.mobile ? ` — ${c.mobile}` : ""}</span>
                        <b>{money(c.outstanding)}</b>
                      </Stack>
                    </li>
                  )}
                  renderInput={(params) => <TextField {...params} size="small" label="Credit customer" placeholder="Search name or phone" />}
                />

                {customer && (
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "#fff8e1", border: "1px solid", borderColor: "warning.light" }}>
                    <Typography variant="body2">Owes now</Typography>
                    <Typography variant="h5" fontWeight={800} color="error.main">LKR {money(owes)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {open?.summary?.has_credit_limit ? `Limit ${money(open.summary.credit_limit)} · Available ${money(open.summary.available_credit)}` : "No credit limit"}
                      {Number(open?.opening_balance) > 0 ? ` · Opening balance ${money(open.opening_balance)}` : ""}
                    </Typography>
                  </Box>
                )}

                <TextField
                  size="small" type="number" label="Amount received (LKR)" value={amount}
                  onChange={(e) => setAmount(e.target.value)} disabled={!customer}
                  error={paid > owes + 0.01}
                  helperText={paid > owes + 0.01 ? `More than the customer owes (${money(owes)})` : " "}
                  InputProps={{ endAdornment: customer && owes > 0 ? <Button size="small" onClick={() => setAmount(owes.toFixed(2))}>Full</Button> : undefined }}
                />
                <TextField select size="small" label="Received into" value={bankAccountId} onChange={(e) => setBankAccountId(Number(e.target.value))}>
                  {(bankAccounts ?? []).map((a: any) => (
                    <MenuItem key={a.id} value={a.id}>{a.bank_account_name}</MenuItem>
                  ))}
                </TextField>
                <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={tranDate} onChange={(e) => setTranDate(e.target.value)} />
                <TextField size="small" label="Note (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />

                {customer && !customer.branch_code && (
                  <Typography variant="caption" color="error">This customer has no branch — add one under Customers first.</Typography>
                )}

                <Button variant="contained" size="large" disabled={!canSave} onClick={() => payMutation.mutate()}>
                  {payMutation.isPending ? "Saving..." : "Receive Payment"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell align="right">Bill</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Owing</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.map((b: any) => (
                  <TableRow key={b.trans_no} hover>
                    <TableCell>{String(b.tran_date).slice(0, 10)}</TableCell>
                    <TableCell>#{b.trans_no}{b.reference ? ` (${b.reference})` : ""}</TableCell>
                    <TableCell align="right">{money(b.total)}</TableCell>
                    <TableCell align="right">{money(b.paid)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{money(b.owing)}</TableCell>
                  </TableRow>
                ))}
                {customer && !isFetching && bills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2">No unpaid credit bills{Number(open?.opening_balance) > 0 ? " — the payment goes to the opening balance." : "."}</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!customer && (
                  <TableRow>
                    <TableCell colSpan={5} align="center"><Typography variant="body2">Select a credit customer to see their unpaid bills.</Typography></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </FormPageLayout>
  );
}
