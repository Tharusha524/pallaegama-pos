import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Paper,
  TextField,
  Typography,
  MenuItem,
  Grid,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import { getPaymentTerms } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getShippingCompanies } from "../../../../api/ShippingCompany/ShippingCompanyApi";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function ModifySalesInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL analytical reports and inquiries');
  const navigate = useNavigate();

  const [customer, setCustomer] = useState("John Traders Pvt Ltd");
  const [branch, setBranch] = useState("Main Branch");
  const [paymentTerm, setPaymentTerm] = useState("");
  const [reference, setReference] = useState("INV/2025/001");
  const [salesType, setSalesType] = useState("Cash");
  const [currency, setCurrency] = useState("LKR");
  const [costCenter, setCostCenter] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");
  const [shippingCost, setShippingCost] = useState(0);

  const [rows, setRows] = useState([
    {
      id: 1,
      itemCode: "ITM-001",
      description: "Cement Bag 50kg",
      delivered: 100,
      units: "Bags",
      credited: 50,
      thisInvoice: 0,
      price: 1250,
      taxType: "VAT 15%",
      discount: 0,
      total: 0,
    },
  ]);

  // === API Queries ===
  const { data: paymentTerms = [] } = useQuery({
    queryKey: ["paymentTerms"],
    queryFn: getPaymentTerms,
  });

  const { data: shippingCompanies = [] } = useQuery({
    queryKey: ["shippingCompanies"],
    queryFn: getShippingCompanies,
  });

  // === Calculations ===
  const subTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const invoiceTotal = subTotal + shippingCost;

  // === Actions ===
  const handleUpdate = () => alert("Invoice updated!");
  const handleProcessInvoice = () => alert("Invoice processed successfully!");

  const breadcrumbItems = [
    { title: "Transactions", href: "/banking/transactions" },
    { title: "Modify Sales Invoice" },
  ];

  return (
    <FormPageLayout>
      {/* Header */}
      <Box
        sx={{
          padding: 2,
          boxShadow: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <PageTitle title="Modify Sales Invoice" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>
      {/* Form */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Customer" value={customer} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Branch" value={branch} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Payment Terms"
              value={paymentTerm}
              onChange={(e) => setPaymentTerm(e.target.value)}
              size="small"
            >
              {paymentTerms.map((term: any) => (
                <MenuItem key={term.terms_indicator} value={term.terms_indicator}>
                  {term.description}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Reference" value={reference} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Sales Type" value={salesType} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Currency" value={currency} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Cost Center"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Shipping Company"
              value={shippingCompany}
              onChange={(e) => setShippingCompany(e.target.value)}
              size="small"
            >
              {shippingCompanies.map((sc: any) => (
                <MenuItem key={sc.id} value={sc.id}>
                  {sc.shipper_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              type="date"
              label="Date"
              fullWidth
              size="small"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              type="date"
              label="Due Date"
              fullWidth
              size="small"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>
      {/* Items Table */}
      <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center" }}>
        Invoice Items
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Item Code</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Delivered</TableCell>
              <TableCell>Units</TableCell>
              <TableCell>Credited</TableCell>
              <TableCell>This Invoice</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Tax Type</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.itemCode}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell>{row.delivered}</TableCell>
                <TableCell>{row.units}</TableCell>
                <TableCell>{row.credited}</TableCell>
                <TableCell>
                  <FormattedNumberField
                    size="small"
                    value={row.thisInvoice}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, thisInvoice: value, total: value * r.price } : r
                        )
                      );
                    }}
                  />
                </TableCell>
                <TableCell>{row.price}</TableCell>
                <TableCell>{row.taxType}</TableCell>
                <TableCell>{row.discount}%</TableCell>
                <TableCell>{row.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={10}>Shipping Cost</TableCell>
              <TableCell>
                <FormattedNumberField
                  size="small"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value))}
                />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={10} sx={{ fontWeight: 600 }}>
                Sub Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{subTotal.toFixed(2)}</TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={10} sx={{ fontWeight: 600 }}>
                Include Tax
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>0.00</TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={10} sx={{ fontWeight: 600 }}>
                Invoice Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{invoiceTotal.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      {/* Memo and Actions */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <TextField
          fullWidth
          label="Memo"
          multiline
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
          <Button variant="contained" color="primary" onClick={handleUpdate}>
            Update
          </Button>
          <Button disabled={!canEdit} variant="contained" color="success" onClick={handleProcessInvoice}>
            Process Invoice
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}