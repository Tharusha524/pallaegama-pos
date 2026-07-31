import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import { getBankAccounts } from "../../../../api/BankAccount/BankAccountApi";
// import { getCostCenters } from "../../../../api/CostCenter/CostCenterApi"; // hypothetical API

import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface AllocationRow {
  transactionType: string;
  number: number;
  ref: string;
  date: string;
  dueDate: string;
  amount: number;
  otherAllocations: number;
  leftToAllocate: number;
  thisAllocation: number;
  all: string;
  none: string;
}

export default function CustomerPaymentEntry() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL analytical reports and inquiries');
  const navigate = useNavigate();

  // ====== Form State ======
  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [depositDate, setDepositDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reference, setReference] = useState("");
  const [bankCharge, setBankCharge] = useState(0);
  const [costCenter, setCostCenter] = useState("");
  const [promptDiscount, setPromptDiscount] = useState(0);
  const [amountOfDiscount, setAmountOfDiscount] = useState(0);
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState("");

  // ====== Allocation Table State ======
  const [allocationRows, setAllocationRows] = useState<AllocationRow[]>([
    {
      transactionType: "Sales Invoice",
      number: 5,
      ref: "002/2025",
      date: "01/01/2025",
      dueDate: "01/01/2025",
      amount: 1300.00,
      otherAllocations: 0.00,
      leftToAllocate: 1300.00,
      thisAllocation: 0.00,
      all: "All",
      none: "None",
    },
  ]);

  // ====== Fetch Data ======
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
    refetchOnWindowFocus: true,
  });
    const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => getBranches(), refetchOnWindowFocus: true });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: getBankAccounts,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    setReference(`${random}/${year}`);
  }, []);

  // Reset branch when customer changes
  useEffect(() => {
    setBranch("");
  }, [customer]);

  // Update prompt discount when customer changes
  useEffect(() => {
    if (customer) {
      const selectedCustomer = customers.find((c: any) => c.debtor_no === customer);
      if (selectedCustomer) {
        setPromptDiscount(selectedCustomer.pymt_discount || 0);
      }
    } else {
      setPromptDiscount(0);
    }
  }, [customer, customers]);

  // ====== Handle Table Changes ======
  const handleAllocationChange = (index: number, value: number) => {
    const updatedRows = [...allocationRows];
    updatedRows[index].thisAllocation = value;
    setAllocationRows(updatedRows);
  };

  // ====== Handle Add Payment ======
  const handleAddPayment = () => {
    if (!customer || !amount) return alert("Please fill required fields!");

    console.log({
      customer,
      branch,
      bankAccount,
      depositDate,
      reference,
      bankCharge,
      costCenter,
      promptDiscount,
      amountOfDiscount,
      amount,
      memo,
      allocations: allocationRows,
    });

    alert("Customer payment added successfully!");
    navigate(-1);
  };

  // ====== Breadcrumb ======
  const breadcrumbItems = [
    { title: "Transactions", href: "/banking/transactions" },
    { title: "Customer Payment Entry" },
  ];

  return (
    <FormPageLayout>
      {/* Header */}
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <PageTitle title="Customer Payment Entry" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </Box>
      {/* Form Section */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Customer"
              fullWidth
              size="small"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              {customers.map((c: any) => (
                <MenuItem key={c.debtor_no} value={c.debtor_no}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Branch"
              fullWidth
              size="small"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches
                .filter((b: any) => b.debtor_no === customer)
                .map((b: any) => (
                  <MenuItem key={b.branch_code} value={b.branch_code}>
                    {b.br_name}
                  </MenuItem>
                ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Into Bank Account"
              fullWidth
              size="small"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
            >
              {bankAccounts.map((acc: any) => (
                <MenuItem key={acc.id} value={acc.id}>
                  {acc.bank_account_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="Date of Deposit"
              type="date"
              fullWidth
              size="small"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="Reference"
              fullWidth
              size="small"
              value={reference}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormattedNumberField
              label="Bank Charge"
              fullWidth
              size="small"
              value={bankCharge}
              onChange={(e) => setBankCharge(Number(e.target.value))}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Cost Center"
              fullWidth
              size="small"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
            >
              {/* {costCenters.map((d: any) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))} */}
            </TextField>
          </Grid>
        </Grid>
      </Paper>
      {/* Allocation Table */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography
          variant="subtitle1"
          sx={{ mb: 2, textAlign: "center", fontWeight: 600 }}
        >
          Allocated amounts in USD
        </Typography>

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Transaction Type</TableCell>
                <TableCell>#</TableCell>
                <TableCell>Ref</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Other Allocations</TableCell>
                <TableCell>Left to allocate</TableCell>
                <TableCell>This allocation</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allocationRows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.transactionType}</TableCell>
                  <TableCell>{row.number}</TableCell>
                  <TableCell>{row.ref}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.dueDate}</TableCell>
                  <TableCell>{row.amount.toFixed(2)}</TableCell>
                  <TableCell>{row.otherAllocations.toFixed(2)}</TableCell>
                  <TableCell>{row.leftToAllocate.toFixed(2)}</TableCell>
                  <TableCell>
                    <FormattedNumberField
                      size="small"
                      value={row.thisAllocation}
                      onChange={(e) => handleAllocationChange(index, Number(e.target.value))}
                      sx={{ width: "100px" }}
                    />
                  </TableCell>
                  <TableCell>{row.all}</TableCell>
                  <TableCell>{row.none}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {/* Payment Section */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography
          variant="subtitle1"
          sx={{ mb: 2, textAlign: "center", fontWeight: 600 }}
        >
          Customer Payment Details
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <FormattedNumberField
              label="Customer Prompt Payment Discount (%)"
              fullWidth
              size="small"
              value={promptDiscount}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormattedNumberField
              label="Amount of Discount"
              fullWidth
              size="small"
              value={amountOfDiscount}
              onChange={(e) => setAmountOfDiscount(Number(e.target.value))}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormattedNumberField
              label="Amount"
              fullWidth
              size="small"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Memo"
              fullWidth
              multiline
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </Grid>
        </Grid>

        <Box
          sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 2 }}
        >
          <Button variant="outlined" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button disabled={!canEdit}
            variant="contained"
            onClick={handleAddPayment}
          >
            Update Payment
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}