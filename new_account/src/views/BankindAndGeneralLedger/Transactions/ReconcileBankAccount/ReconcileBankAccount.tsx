import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Stack,
  Paper,
  TextField,
  MenuItem,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  TablePagination,
  Checkbox,
  Typography,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBankAccounts } from "../../../../api/BankAccount/BankAccountApi";
import {
  getUnreconciledBankTrans,
  postBankReconcile,
} from "../../../../api/Banking/BankingTransactionApi";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { useAuth } from "../../../../context/AuthContext";

interface TransactionRow {
  id: number;
  type: string;
  number: string;
  reference: string;
  date: string;
  debit: number;
  credit: number;
  amount: number;
  selected: boolean;
}

export default function ReconcileBankAccount() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Bank reconciliation');
  const navigate = useNavigate();

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: getBankAccounts,
  });

  const [selectedAccount, setSelectedAccount] = useState("");
  const [reconcileData, setReconcileData] = useState({
    reconcileDate: new Date().toISOString().split("T")[0],
    beginningBalance: "",
    endingBalance: "",
  });
  const [transactionRows, setTransactionRows] = useState<TransactionRow[]>([]);
  const [bookBalance, setBookBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadUnreconciled = async (bankId: string) => {
    if (!bankId) {
      setTransactionRows([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getUnreconciledBankTrans(Number(bankId));
      setBookBalance(data.book_balance ?? 0);
      setReconcileData((prev) => ({
        ...prev,
        beginningBalance: String(data.ending_reconcile_balance ?? 0),
        endingBalance: String(data.book_balance ?? 0),
      }));
      setTransactionRows(
        (data.transactions || []).map((t: any) => ({
          id: t.id,
          type: t.type,
          number: String(t.number),
          reference: t.reference,
          date: t.date,
          debit: t.debit,
          credit: t.credit,
          amount: t.amount,
          selected: true,
        }))
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load unreconciled transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnreconciled(selectedAccount);
  }, [selectedAccount]);

  const selectedBankAccount = (bankAccounts as any[]).find(
    (acc: any) => String(acc.id) === selectedAccount
  );

  const reconciledAmount = useMemo(() => {
    const base = parseFloat(reconcileData.beginningBalance) || 0;
    const selectedSum = transactionRows
      .filter((r) => r.selected)
      .reduce((sum, r) => sum + r.amount, 0);
    return base + selectedSum;
  }, [transactionRows, reconcileData.beginningBalance]);

  const difference = useMemo(() => {
    const ending = parseFloat(reconcileData.endingBalance) || 0;
    return ending - reconciledAmount;
  }, [reconcileData.endingBalance, reconciledAmount]);

  const handleReconcile = async () => {
    if (!selectedAccount) {
      setError("Select a bank account");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await postBankReconcile({
        bank_account_id: Number(selectedAccount),
        reconcile_date: reconcileData.reconcileDate,
        ending_balance: parseFloat(reconcileData.endingBalance) || 0,
        transaction_ids: transactionRows.filter((r) => r.selected).map((r) => r.id),
      });
      setSuccess("Bank account reconciled successfully.");
      await loadUnreconciled(selectedAccount);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Reconcile failed");
    } finally {
      setSaving(false);
    }
  };

  const paginatedRows = useMemo(() => {
    if (rowsPerPage === -1) return transactionRows;
    return transactionRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [transactionRows, page, rowsPerPage]);

  return (
    <FormPageLayout>
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Box>
          <PageTitle title="Reconcile Bank Account" />
          <Breadcrumb
            breadcrumbs={[{ title: "Home", href: "/dashboard" }, { title: "Reconcile Bank Account" }]}
          />
        </Box>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Account"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              size="small"
            >
              <MenuItem value="">Select Account</MenuItem>
              {(bankAccounts as any[]).map((acc: any) => (
                <MenuItem key={acc.id} value={String(acc.id)}>
                  {acc.bank_account_name ??
                    `${acc.bank_name || ""} - ${acc.bank_account_number || ""}`}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
              Book balance: <strong>{bookBalance.toFixed(2)}</strong>
            </Typography>
          </Grid>
        </Grid>
      </Paper>
      <TableContainer component={Paper} sx={{ p: 1 }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>Reconcile Date</TableCell>
              <TableCell>Beginning (last reconcile)</TableCell>
              <TableCell>Statement ending balance</TableCell>
              <TableCell>Calculated total</TableCell>
              <TableCell>Difference</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>
                <TextField
                  type="date"
                  size="small"
                  value={reconcileData.reconcileDate}
                  onChange={(e) =>
                    setReconcileData((prev) => ({ ...prev, reconcileDate: e.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </TableCell>
              <TableCell>
                <TextField size="small" value={reconcileData.beginningBalance} InputProps={{ readOnly: true }} />
              </TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={reconcileData.endingBalance}
                  onChange={(e) =>
                    setReconcileData((prev) => ({ ...prev, endingBalance: e.target.value }))
                  }
                />
              </TableCell>
              <TableCell>
                <TextField size="small" value={reconciledAmount.toFixed(2)} InputProps={{ readOnly: true }} />
              </TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={difference.toFixed(2)}
                  InputProps={{ readOnly: true }}
                  error={Math.abs(difference) > 0.01}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      {selectedBankAccount && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" align="center">
            {selectedBankAccount.bank_account_name}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Currency: {selectedBankAccount.bank_curr_code}
          </Typography>
        </Paper>
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>#</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Debit</TableCell>
              <TableCell align="right">Credit</TableCell>
              <TableCell align="center">Reconcile</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>Loading...</TableCell>
              </TableRow>
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No unreconciled transactions</TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{row.number}</TableCell>
                  <TableCell>{row.reference}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell align="right">{row.debit > 0 ? row.debit.toFixed(2) : ""}</TableCell>
                  <TableCell align="right">{row.credit > 0 ? row.credit.toFixed(2) : ""}</TableCell>
                  <TableCell align="center">
                    <Checkbox
                      checked={row.selected}
                      onChange={() =>
                        setTransactionRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, selected: !r.selected } : r))
                        )
                      }
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                colSpan={7}
                count={transactionRows.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          disabled={!selectedAccount || saving || !canEdit || Math.abs(difference) > 0.01}
          onClick={handleReconcile}
        >
          {saving ? "Saving..." : "Reconcile"}
        </Button>
      </Box>
    </FormPageLayout>
  );
}
