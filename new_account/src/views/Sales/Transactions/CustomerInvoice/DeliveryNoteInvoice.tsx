import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
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
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import { getPaymentTerms } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getShippingCompanies } from "../../../../api/ShippingCompany/ShippingCompanyApi";
import { getDebtorTrans } from "../../../../api/DebtorTrans/DebtorTransApi";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import { getSalesTypes } from "../../../../api/SalesMaintenance/salesService";
import { getDebtorTransDetails } from "../../../../api/DebtorTrans/DebtorTransDetailsApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { getItemTaxTypes } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { updateDebtorTran } from "../../../../api/DebtorTrans/DebtorTransApi";
import { invoiceFromDelivery } from "../../../../api/SalesInvoice/SalesInvoiceApi";
import { useNextFiscalYearReference } from "../../../../hooks/useNextFiscalYearReference";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import {
  isCashSalePaymentTerm,
  validateCustomerCreditForSale,
} from "../../../../utils/customerCredit";
import { useCustomerCredit } from "../../../../hooks/useCustomerCredit";
import CustomerCreditSummaryFields from "../../../../components/CustomerCreditSummaryFields";
import { useTransactionMoney } from "../../../../hooks/useTransactionMoney";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { runTransactionSave } from "../../../../utils/transactionSave";
import { useMessageDialog } from "../../../../context/MessageDialogContext";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

function findDeliveryNote(
  debtorTrans: any[],
  transNo?: string | number | null,
  reference?: string | null
) {
  if (transNo != null && String(transNo).trim() !== "") {
    const match = debtorTrans.find(
      (d) => Number(d.trans_type) === 13 && Number(d.trans_no) === Number(transNo)
    );
    if (match) return match;
  }
  if (reference) {
    return debtorTrans.find(
      (d) => Number(d.trans_type) === 13 && String(d.reference) === String(reference)
    );
  }
  return undefined;
}

export default function DeliveyNoteInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Direct sales delivery entry');
  const navigate = useNavigate();
  const { showError, showSuccess } = useMessageDialog();
  const { state } = useLocation();
  const {
    reference: stateReference,
    date: stateDate,
    trans_no: stateTransNo,
  } = (state || {}) as {
    reference?: string;
    date?: string;
    trans_no?: string | number;
  };

  // === Fields ===
  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("");
  const [reference, setReference] = useState(stateReference || "");
  const [salesType, setSalesType] = useState("");
  const [currency, setCurrency] = useState("");
  const { formatMoney } = useTransactionMoney(currency);
  const [shippingCompany, setShippingCompany] = useState("");
  const [date, setDate] = useState(stateDate || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [dateError, setDateError] = useState("");

  // === Table Data ===
  const [rows, setRows] = useState([]);

  // === API Queries ===
  const { data: paymentTerms = [] } = useQuery({
    queryKey: ["paymentTerms"],
    queryFn: getPaymentTerms,
  });

  const { data: shippingCompanies = [] } = useQuery({
    queryKey: ["shippingCompanies"],
    queryFn: getShippingCompanies,
  });

  const { data: debtorTrans = [] } = useQuery({
    queryKey: ["debtorTrans"],
    queryFn: getDebtorTrans,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => getBranches(),
  });

  const { data: salesTypes = [] } = useQuery({
    queryKey: ["salesTypes"],
    queryFn: getSalesTypes,
  });

  const { data: debtorTransDetails = [] } = useQuery({
    queryKey: ["debtorTransDetails"],
    queryFn: getDebtorTransDetails,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });

  const { data: itemUnits = [] } = useQuery({
    queryKey: ["itemUnits"],
    queryFn: getItemUnits,
  });

  const { data: itemTaxTypes = [] } = useQuery({
    queryKey: ["itemTaxTypes"],
    queryFn: getItemTaxTypes,
  });

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ["fiscalYears"],
    queryFn: getFiscalYears,
  });

  const { data: companyData } = useQuery({
    queryKey: ["company"],
    queryFn: getCompanies,
  });

  // Find selected fiscal year from company setup
  const selectedFiscalYear = useMemo(() => {
    if (!companyData || companyData.length === 0) return null;
    const company = companyData[0];
    return fiscalYears.find((fy: any) => fy.id === company.fiscal_year_id);
  }, [companyData, fiscalYears]);

  // Validate date is within fiscal year
  const validateDate = (selectedDate: string) => {
    if (!selectedFiscalYear) {
      setDateError("No fiscal year selected from company setup");
      return false;
    }

    if (selectedFiscalYear.closed) {
      setDateError("The fiscal year is closed for further data entry.");
      return false;
    }

    const selected = new Date(selectedDate);
    const from = new Date(selectedFiscalYear.fiscal_year_from);
    const to = new Date(selectedFiscalYear.fiscal_year_to);

    if (selected < from || selected > to) {
      setDateError("The entered date is out of fiscal year.");
      return false;
    }

    setDateError("");
    return true;
  };

  // Handle date change with validation
  const handleDateChange = (value: string) => {
    setDate(value);
    validateDate(value);
  };

  // Validate date when fiscal year changes
  useEffect(() => {
    if (selectedFiscalYear) {
      validateDate(date);
    }
  }, [selectedFiscalYear]);

  const queryClient = useQueryClient();

  const delivery = useMemo(
    () => findDeliveryNote(debtorTrans, stateTransNo, stateReference),
    [debtorTrans, stateTransNo, stateReference]
  );

  const { reference: nextInvoiceReference } = useNextFiscalYearReference(10, {
    asOfDate: date,
    enabled: Boolean(stateTransNo || stateReference || delivery),
  });

  useEffect(() => {
    if (!delivery || customers.length === 0) {
      return;
    }

    const customerData = customers.find(
      (c: any) => String(c.debtor_no) === String(delivery.debtor_no)
    );
    const branchData = branches.find(
      (b: any) => String(b.branch_code) === String(delivery.branch_code)
    );
    const salesTypeData = salesTypes.find(
      (st: any) => String(st.id) === String(delivery.tpe)
    );

    setCustomer(customerData?.name || "Customer not found");
    setBranch(branchData?.br_name || "Branch not found");
    setCurrency(customerData?.curr_code || "Currency not found");
    setSalesType(
      salesTypeData?.typeName ||
        (salesTypeData as { sales_type?: string } | undefined)?.sales_type ||
        "Sales type not found"
    );
    setReference(String(delivery.reference ?? stateReference ?? ""));
    setPaymentTerm(
      delivery.payment_terms != null ? String(delivery.payment_terms) : ""
    );
    setShippingCompany(
      delivery.ship_via != null ? String(delivery.ship_via) : ""
    );
    setShippingCost(parseFloat(String(delivery.ov_freight ?? 0)) || 0);
    if (delivery.due_date) {
      setDueDate(String(delivery.due_date).split(" ")[0]);
    }

    const deliveryDetails = debtorTransDetails.filter(
      (dd: any) =>
        Number(dd.debtor_trans_type) === 13 &&
        Number(dd.debtor_trans_no) === Number(delivery.trans_no)
    );

    if (deliveryDetails.length === 0) {
      setRows([]);
      return;
    }

    const newRows = deliveryDetails.map((detail: any, index: number) => {
      const itemData = items.find((i: any) => i.stock_id === detail.stock_id);
      const unitData = itemUnits.find((u: any) => u.id === itemData?.units);
      const unitName = unitData?.abbr || detail.units || "";
      const price = parseFloat(detail.unit_price || 0);
      const delivered = parseFloat(detail.quantity || 0);
      const invoiced = parseFloat(detail.qty_done || 0);
      const remaining = Math.max(0, delivered - invoiced);
      const taxTypeData = itemTaxTypes.find(
        (t: any) => String(t.id) === String(itemData?.tax_type_id)
      );
      const taxRate = parseFloat(taxTypeData?.rate || 15);
      const unitTax = price * (taxRate / 100);
      const standardCost = parseFloat(itemData?.standard_cost || 0);

      return {
        id: index + 1,
        itemCode: detail.stock_id || "",
        description: detail.description || "",
        delivered,
        units: unitName,
        invoiced,
        thisInvoice: remaining,
        price,
        taxType: taxTypeData?.name,
        discount: parseFloat(detail.discount_percent || 0),
        total: remaining * price,
        src_id: detail.id,
        unitTax,
        standardCost,
      };
    });

    setRows(newRows.filter((row) => row.thisInvoice > 0));
  }, [
    delivery,
    stateReference,
    customers,
    branches,
    salesTypes,
    debtorTransDetails,
    items,
    itemUnits,
    itemTaxTypes,
  ]);

  // === Calculations ===
  const subTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const invoiceTotal = subTotal + shippingCost;

  const deliveryDebtorNo = delivery?.debtor_no ?? null;

  const { summary: creditSummary, isLoading: creditLoading } = useCustomerCredit(
    deliveryDebtorNo,
    customers
  );

  // === Actions ===
  const handleUpdate = async () => {
    if (!delivery) {
      showError("Delivery not found.");
      return;
    }

    try {
      const recordId = delivery.id ?? delivery.trans_no;
      await updateDebtorTran(recordId, {
        tran_date: date,
        due_date: dueDate || date,
        ov_freight: shippingCost,
        ship_via: shippingCompany ? Number(shippingCompany) : null,
        payment_terms: paymentTerm ? Number(paymentTerm) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["debtorTrans"] });
      showSuccess("Invoice header saved against delivery note.");
    } catch (error: unknown) {
      console.error("Error updating delivery for invoice:", error);
      showError(getFriendlyApiErrorMessage(error), "Failed to save");
    }
  };

  const handleProcessInvoice = async () => {
    if (!delivery) {
      showError("Delivery not found.");
      return;
    }

    const filteredRows = rows.filter(
      (r: any) => Number(r.thisInvoice) > 0 && Number(r.src_id) > 0
    );
    if (filteredRows.length === 0) {
      showError("No quantities selected for invoicing.");
      return;
    }

    const creditError = validateCustomerCreditForSale({
      summary: creditSummary,
      documentTotal: invoiceTotal,
      skipCreditCheck: isCashSalePaymentTerm(paymentTerms, paymentTerm),
    });
    if (creditError) {
      showError(creditError);
      return;
    }

    const saveResult = await runTransactionSave(() =>
      invoiceFromDelivery({
        delivery_trans_no: Number(delivery.trans_no),
        tran_date: date,
        due_date: dueDate || date,
        ship_via: Number(shippingCompany) || Number(delivery.ship_via) || null,
        freight_cost: shippingCost,
        payment_terms: paymentTerm ? Number(paymentTerm) : null,
        comments: memo || undefined,
        reference: nextInvoiceReference || undefined,
        lines: filteredRows.map((r: any) => ({
          delivery_detail_id: Number(r.src_id),
          quantity: Number(r.thisInvoice),
        })),
      })
    );

    if ("message" in saveResult) {
      showError(saveResult.message, "Error processing invoice");
      return;
    }

    const result = saveResult.data;

    await queryClient.invalidateQueries({ queryKey: ["debtorTransDetails"] });
    await queryClient.invalidateQueries({ queryKey: ["debtorTrans"] });
    await queryClient.invalidateQueries({
      queryKey: ["customerCreditSummary", delivery.debtor_no],
    });

    if (result.gl_warning) {
      console.warn("Invoice GL warning:", result.gl_warning);
    }

    navigate("/sales/transactions/direct-delivery/customer-invoice/success", {
      state: {
        transNo: result.trans_no,
        reference: result.reference ?? nextInvoiceReference,
        date,
      },
    });
  };

  const breadcrumbItems = [
    { title: "Transactions", href: "/sales/transactions" },
    { title: "Issue an Invoice for Delivery Note invoice" },
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
          <PageTitle title="Issue an Invoice for Delivery Note" />
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
            <CustomerCreditSummaryFields
              summary={creditSummary}
              documentTotal={invoiceTotal}
              isLoading={creditLoading}
              currencyCode={currency}
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
                <MenuItem key={sc.shipper_id} value={sc.shipper_id}>
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
              onChange={(e) => handleDateChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_from).toISOString().split('T')[0] : undefined,
                max: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_to).toISOString().split('T')[0] : undefined,
              }}
              error={!!dateError}
              helperText={dateError}
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
              <TableCell>Invoiced</TableCell>
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
                <TableCell>{row.invoiced}</TableCell>
                <TableCell>
                  <FormattedNumberField
                    size="small"
                    value={row.thisInvoice}
                    onChange={(e) => {
                      let value = Number(e.target.value);
                      const maxAvailable = row.delivered - row.invoiced;
                      if (value > maxAvailable) {
                        value = maxAvailable;
                      }
                      if (value < 0) {
                        value = 0;
                      }
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, thisInvoice: value, total: value * r.price } : r
                        )
                      );
                    }}
                    inputProps={{ min: 0, max: row.delivered - row.invoiced }}
                  />
                </TableCell>
                <TableCell>{row.price}</TableCell>
                <TableCell>{row.taxType}</TableCell>
                <TableCell>{row.discount}%</TableCell>
                <TableCell>{formatMoney(row.total)}</TableCell>
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
              <TableCell sx={{ fontWeight: 600 }}>{formatMoney(subTotal)}</TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={10} sx={{ fontWeight: 600 }}>
                Invoice Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{formatMoney(invoiceTotal)}</TableCell>
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
          <Button variant="contained" color="primary" onClick={handleUpdate} disabled={!!dateError}>
            Update
          </Button>
          <Button variant="contained" color="success" onClick={handleProcessInvoice} disabled={!!dateError || !canEdit}>
            Process Invoice
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
