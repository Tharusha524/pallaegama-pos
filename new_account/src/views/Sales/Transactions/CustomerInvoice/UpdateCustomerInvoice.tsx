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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import { getPaymentTerms } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getShippingCompanies } from "../../../../api/ShippingCompany/ShippingCompanyApi";
import { getDebtorTrans } from "../../../../api/DebtorTrans/DebtorTransApi";
import { getDebtorTransDetails } from "../../../../api/DebtorTrans/DebtorTransDetailsApi";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import { getSalesTypes } from "../../../../api/SalesMaintenance/salesService";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { getItemTaxTypes } from "../../../../api/ItemTaxType/ItemTaxTypeApi.tsx";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import { updateDebtorTran } from "../../../../api/DebtorTrans/DebtorTransApi";
import { updateDebtorTransDetail } from "../../../../api/DebtorTrans/DebtorTransDetailsApi";
import { getSalesOrders } from "../../../../api/SalesOrders/SalesOrdersApi";
import { getCustAllocations } from "../../../../api/CustAllocation/CustAllocationApi";
import { getCostCenters } from "../../../../api/CostCenter/CostCenterApi";
import {
  isCashSalePaymentTerm,
  validateCustomerCreditForSale,
} from "../../../../utils/customerCredit";
import { useCustomerCredit } from "../../../../hooks/useCustomerCredit";
import CustomerCreditSummaryFields from "../../../../components/CustomerCreditSummaryFields";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function UpdateCustomerInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Customer transaction inquiry');
  const navigate = useNavigate();

  // === Fields ===
  const { state } = useLocation();
  const { trans_no, reference: navReference, date: navDate } = (state || {}) as any;

  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("");
  const [reference, setReference] = useState(navReference || "");
  const [salesType, setSalesType] = useState("");
  const [currency, setCurrency] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [date, setDate] = useState(navDate || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [costCenter, setCostCenter] = useState("");
  const [dateError, setDateError] = useState("");

  const isUpdate = !!trans_no;
  const [currentVersion, setCurrentVersion] = useState(0);

  // === Table Data ===
  const [rows, setRows] = useState<any[]>([]);
  const [originalInvoice, setOriginalInvoice] = useState<any>(null);

  // === API Queries ===
  const { data: paymentTerms = [] } = useQuery({ queryKey: ["paymentTerms"], queryFn: getPaymentTerms });
  const { data: shippingCompanies = [] } = useQuery({ queryKey: ["shippingCompanies"], queryFn: getShippingCompanies });

  const { data: debtorTransList = [] } = useQuery({ queryKey: ["debtorTrans"], queryFn: getDebtorTrans });
  const { data: debtorTransDetails = [] } = useQuery({ queryKey: ["debtorTransDetails"], queryFn: getDebtorTransDetails });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => getBranches() });
  const { data: salesTypes = [] } = useQuery({ queryKey: ["salesTypes"], queryFn: getSalesTypes });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: itemUnits = [] } = useQuery({ queryKey: ["itemUnits"], queryFn: getItemUnits });
  const { data: itemTaxTypes = [] } = useQuery({ queryKey: ["itemTaxTypes"], queryFn: getItemTaxTypes });

  const { data: fiscalYears = [] } = useQuery({ queryKey: ["fiscalYears"], queryFn: getFiscalYears });
  const { data: companyData } = useQuery({
    queryKey: ["company"],
    queryFn: getCompanies,
  });
  const { data: salesOrders = [] } = useQuery({ queryKey: ["salesOrders"], queryFn: getSalesOrders });
  const { data: custAllocations = [] } = useQuery({ queryKey: ["custAllocations"], queryFn: async () => (await getCustAllocations()).data });
  const { data: costCenters = [] } = useQuery({ queryKey: ["costCenters"], queryFn: getCostCenters });

  const queryClient = useQueryClient();

  // Mutations
  const updateDebtorTranMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => updateDebtorTran(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtorTrans"] });
      queryClient.invalidateQueries({ queryKey: ["debtorTransDetails"] });
    },
  });

  const updateDebtorTransDetailMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => updateDebtorTransDetail(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtorTransDetails"] });
    },
  });

  // Find selected fiscal year from company setup
  const selectedFiscalYear = useMemo(() => {
    if (!companyData || companyData.length === 0) return null;
    const company = companyData[0];
    return fiscalYears.find((fy: any) => fy.id === company.fiscal_year_id);
  }, [companyData, fiscalYears]);

  // Find selected payment term
  const selectedPaymentTerm = useMemo(() => {
    return paymentTerms.find((pt: any) => String(pt.terms_indicator) === String(originalInvoice?.payment_terms));
  }, [originalInvoice?.payment_terms, paymentTerms]);

  // Find current payment term based on form selection
  const currentPaymentTerm = useMemo(() => {
    return paymentTerms.find((pt: any) => String(pt.terms_indicator) === String(paymentTerm));
  }, [paymentTerm, paymentTerms]);

  const selectedPaymentType = useMemo(() => {
    const pt = selectedPaymentTerm?.payment_type;
    if (pt == null) return null;
    if (typeof pt === "number") return pt;
    // try common id fields when payment_type is an object
    return pt.id ?? pt.payment_type ?? null;
  }, [selectedPaymentTerm]);

  const currentPaymentType = useMemo(() => {
    const pt = currentPaymentTerm?.payment_type;
    if (pt == null) return null;
    if (typeof pt === "number") return pt;
    // try common id fields when payment_type is an object
    return pt.id ?? pt.payment_type ?? null;
  }, [currentPaymentTerm]);

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

  // === Calculations ===
  const subTotal = rows.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const invoiceTotal = subTotal + shippingCost;
  const paymentsReceived = custAllocations.filter(ca => ca.trans_no_to === originalInvoice?.trans_no && ca.trans_type_to === 10 && ca.trans_type_from === 12).reduce((sum, ca) => sum + Number(ca.amt || 0), 0);
  const paymentRef = debtorTransList.find(dt => dt.trans_no === custAllocations.find(ca => ca.trans_no_to === originalInvoice?.trans_no && ca.trans_type_to === 10 && ca.trans_type_from === 12)?.trans_no_from && dt.trans_type === 12)?.reference || '';

  const { summary: creditSummary, isLoading: creditLoading } = useCustomerCredit(
    originalInvoice?.debtor_no ?? null,
    customers
  );

  const assertCreditForInvoice = () => {
    const creditError = validateCustomerCreditForSale({
      summary: creditSummary,
      documentTotal: invoiceTotal,
      skipCreditCheck: isCashSalePaymentTerm(paymentTerms, paymentTerm),
    });
    if (creditError) {
      alert(creditError);
      return false;
    }
    return true;
  };

  // === Actions ===
  const handleUpdate = async () => {
    if (!originalInvoice) {
      alert("No invoice data found");
      return;
    }
    if (!assertCreditForInvoice()) {
      return;
    }

    try {
      // Prepare main transaction update data
      const updateData = {
        payment_terms: paymentTerm,
        ship_via: shippingCompany,
        tran_date: date,
        due_date: dueDate,
        ov_freight: shippingCost,
        ov_amount: invoiceTotal,
        prep_amount: currentPaymentType === 1 ? invoiceTotal : 0,
        cost_center_id: costCenter ? Number(costCenter) : null,
      };

      console.log("Updating debtor transaction:", originalInvoice.trans_no, updateData);

      // Update main transaction
      await updateDebtorTranMutation.mutateAsync({
        id: originalInvoice.id,
        data: updateData,
      });

      console.log("Debtor transaction updated successfully");

      // Update details if quantities changed
      console.log("Starting detail updates. Rows count:", rows.length);
      console.log("Debtor trans details count:", debtorTransDetails.length);

      for (const row of rows) {
        // Find detail by matching debtor_trans_no and debtor_trans_type = 10, and stock_id
        const originalDetail = debtorTransDetails.find((d: any) =>
          String(d.debtor_trans_no) === String(originalInvoice.trans_no) &&
          d.debtor_trans_type === 10 &&
          String(d.stock_id) === String(row.itemCode)
        );

        console.log("Processing row:", {
          rowId: row.id,
          itemCode: row.itemCode,
          thisInvoice: row.thisInvoice,
          detailFound: !!originalDetail,
          originalDetail: originalDetail ? {
            id: originalDetail.id,
            debtor_trans_no: originalDetail.debtor_trans_no,
            debtor_trans_type: originalDetail.debtor_trans_type,
            stock_id: originalDetail.stock_id,
            quantity: originalDetail.quantity
          } : null
        });

        if (originalDetail && Number(originalDetail.quantity) !== Number(row.thisInvoice)) {
          const detailUpdateData = {
            quantity: row.thisInvoice,
            // Recalculate total if needed, but probably handled on backend
          };
          console.log("Updating detail:", originalDetail.id, detailUpdateData);

          try {
            await updateDebtorTransDetailMutation.mutateAsync({
              id: originalDetail.id,
              data: detailUpdateData,
            });
            console.log("Detail updated successfully for row:", row.id);
          } catch (error) {
            console.error("Failed to update detail for row:", row.id, error);
          }

          // Also update the corresponding delivery detail (trans_type=13)
          const deliveryDetail = debtorTransDetails.find((d: any) =>
            String(d.debtor_trans_no) === String(originalInvoice.trans_no) &&
            d.debtor_trans_type === 13 &&
            String(d.stock_id) === String(row.itemCode)
          );

          if (deliveryDetail && Number(deliveryDetail.quantity) !== Number(row.thisInvoice)) {
            const deliveryUpdateData = {
              qty_done: row.thisInvoice,
            };
            console.log("Updating delivery detail:", deliveryDetail.id, deliveryUpdateData);

            try {
              await updateDebtorTransDetailMutation.mutateAsync({
                id: deliveryDetail.id,
                data: deliveryUpdateData,
              });
              console.log("Delivery detail updated successfully for row:", row.id);
            } catch (error) {
              console.error("Failed to update delivery detail for row:", row.id, error);
            }
          }
        } else {
          console.log("Detail update skipped for row:", row.id, {
            detailFound: !!originalDetail,
            quantityChanged: originalDetail ? Number(originalDetail.quantity) !== Number(row.thisInvoice) : false,
            originalQty: originalDetail?.quantity,
            newQty: row.thisInvoice
          });
        }
      }

      console.log("Detail updates completed");

      alert("Invoice updated successfully!");
      await queryClient.invalidateQueries({
        queryKey: ["customerCreditSummary", originalInvoice.debtor_no],
      });
      navigate("/sales/inquiriesandreports/customer-transaction-inquiry/success", { state: { trans_no, reference, date } });
    } catch (error) {
      console.error("Error updating invoice:", error);
      alert("Failed to update invoice. Please try again.");
    }
  };
  const handleProcessInvoice = async () => {
    if (!originalInvoice) {
      alert("No invoice data found");
      return;
    }
    if (!assertCreditForInvoice()) {
      return;
    }

    try {
      // Prepare processing update data
      // In accounting systems, processing typically involves:
      // - Setting allocation amount
      // - Updating status or posted flag
      const processData = {
        alloc: originalInvoice.ov_amount || invoiceTotal, // Allocation amount
       // posted: true, // Mark as posted to GL
        payment_terms: paymentTerm,
        ship_via: shippingCompany,
        tran_date: date,
        due_date: dueDate,
        ov_freight: shippingCost,
        ov_amount: invoiceTotal,
        prep_amount: currentPaymentType === 1 ? invoiceTotal : 0,
        cost_center_id: costCenter ? Number(costCenter) : null,
        // status: 'processed', // Alternative status field
      };

      console.log("Processing invoice:", originalInvoice.trans_no, processData);

      // Update main transaction to mark as processed
      await updateDebtorTranMutation.mutateAsync({
        id: originalInvoice.id,
        data: processData,
      });

      console.log("Invoice processed successfully");

      // Update details if quantities changed
      console.log("Starting detail updates for processing. Rows count:", rows.length);
      console.log("Debtor trans details count:", debtorTransDetails.length);

      for (const row of rows) {
        // Find detail by matching debtor_trans_no and debtor_trans_type = 10, and stock_id
        const originalDetail = debtorTransDetails.find((d: any) =>
          String(d.debtor_trans_no) === String(originalInvoice.trans_no) &&
          d.debtor_trans_type === 10 &&
          String(d.stock_id) === String(row.itemCode)
        );

        console.log("Processing row for processing:", {
          rowId: row.id,
          itemCode: row.itemCode,
          thisInvoice: row.thisInvoice,
          detailFound: !!originalDetail,
          originalDetail: originalDetail ? {
            id: originalDetail.id,
            debtor_trans_no: originalDetail.debtor_trans_no,
            debtor_trans_type: originalDetail.debtor_trans_type,
            stock_id: originalDetail.stock_id,
            quantity: originalDetail.quantity
          } : null
        });

        if (originalDetail && Number(originalDetail.quantity) !== Number(row.thisInvoice)) {
          const detailUpdateData = {
            quantity: row.thisInvoice,
            // Recalculate total if needed, but probably handled on backend
          };
          console.log("Updating detail during processing:", originalDetail.id, detailUpdateData);

          try {
            await updateDebtorTransDetailMutation.mutateAsync({
              id: originalDetail.id,
              data: detailUpdateData,
            });
            console.log("Detail updated successfully for row during processing:", row.id);
          } catch (error) {
            console.error("Failed to update detail for row during processing:", row.id, error);
          }

          // Also update the corresponding delivery detail (trans_type=13)
          const deliveryDetail = debtorTransDetails.find((d: any) =>
            String(d.debtor_trans_no) === String(originalInvoice.trans_no) &&
            d.debtor_trans_type === 13 &&
            String(d.stock_id) === String(row.itemCode)
          );

          if (deliveryDetail && Number(deliveryDetail.quantity) !== Number(row.thisInvoice)) {
            const deliveryUpdateData = {
              qty_done: row.thisInvoice,
            };
            console.log("Updating delivery detail during processing:", deliveryDetail.id, deliveryUpdateData);

            try {
              await updateDebtorTransDetailMutation.mutateAsync({
                id: deliveryDetail.id,
                data: deliveryUpdateData,
              });
              console.log("Delivery detail updated successfully for row during processing:", row.id);
            } catch (error) {
              console.error("Failed to update delivery detail for row during processing:", row.id, error);
            }
          }
        } else {
          console.log("Detail update skipped for row during processing:", row.id, {
            detailFound: !!originalDetail,
            quantityChanged: originalDetail ? Number(originalDetail.quantity) !== Number(row.thisInvoice) : false,
            originalQty: originalDetail?.quantity,
            newQty: row.thisInvoice
          });
        }
      }

      console.log("Detail updates completed for processing");

      alert("Invoice processed successfully!");
      navigate("/sales/inquiriesandreports/customer-transaction-inquiry/success", { state: { trans_no, reference, date } });
    } catch (error) {
      console.error("Error processing invoice:", error);
      alert("Failed to process invoice. Please try again.");
    }
  };

  const breadcrumbItems = [
    { title: "Transactions", href: "/sales/transactions" },
    { title: `Modifying Sales Invoice # ${trans_no || ""}` },
  ];

  // Prefill form when debtor trans and details are available
  useEffect(() => {
    if (!trans_no || debtorTransList.length === 0 || customers.length === 0) return;

    const invoice = debtorTransList.find((d: any) => String(d.trans_no) === String(trans_no) && d.trans_type === 10);
    if (!invoice) return;

    setOriginalInvoice(invoice);
    setCurrentVersion(invoice.version || 0);

    // basic fields
    const customerData = customers.find((c: any) => String(c.debtor_no) === String(invoice.debtor_no));
    const branchData = (branches || []).find((b: any) => String(b.branch_code) === String(invoice.branch_code));
    const salesTypeData = (salesTypes || []).find((st: any) => String(st.id) === String(invoice.tpe));

    setCustomer(customerData?.name || String(invoice.debtor_no || ""));
    setBranch(branchData?.br_name || String(invoice.branch_code || ""));
    setCurrency(customerData?.curr_code || invoice.curr_code || "");
    setSalesType(salesTypeData?.typeName || "");
    setReference(invoice.reference || navReference || "");
    setDate(invoice.tran_date ? String(invoice.tran_date).split(" ")[0] : (navDate || new Date().toISOString().split("T")[0]));
    setDueDate(invoice.due_date ? String(invoice.due_date).split(" ")[0] : "");
    setPaymentTerm(invoice.payment_terms || "");
    setShippingCompany(invoice.ship_via || "");
    setMemo(invoice.memo_ || invoice.comments || "");
    setCostCenter(invoice.cost_center_id != null ? String(invoice.cost_center_id) : "");

    // rows from details (only invoice lines: debtor_trans_type = 10)
    const details = (debtorTransDetails || []).filter(
      (d: any) => String(d.debtor_trans_no) === String(invoice.trans_no) && Number(d.debtor_trans_type) === 10
    );
    if (details.length > 0) {
      const newRows = details.map((detail: any, index: number) => {
        const itemData = (items || []).find((i: any) => String(i.stock_id) === String(detail.stock_id));
        const unitData = (itemUnits as any[] || []).find((u: any) => String(u.id) === String(itemData?.units));
        const taxTypeData = (itemTaxTypes || []).find((t: any) => String(t.id) === String(itemData?.tax_type_id));
        const price = Number(detail.unit_price || 0);
        const qty = Number(detail.quantity || 0);
        const discount = Number(detail.discount_percent || 0);
        const total = qty * price * (1 - discount / 100);

        // Find delivered quantity from debtor_trans_type = 13
        const deliveredDetail = (debtorTransDetails || []).find((d: any) =>
          String(d.debtor_trans_no) === String(invoice.trans_no) &&
          Number(d.debtor_trans_type) === 13 &&
          String(d.stock_id) === String(detail.stock_id)
        );
        const deliveredQty = Number(deliveredDetail?.quantity || 0);

        return {
          id: index + 1,
          itemCode: detail.stock_id || "",
          description: detail.description || "",
          delivered: deliveredQty,
          units: unitData?.abbr || detail.units || "",
          //invoiced: Number(detail.qty_invoiced || 0),
            invoiced: Number(detail.qty_done || 0),
          thisInvoice: qty,
          price: price,
          taxType: taxTypeData?.name || "",
          discount: discount,
          total: total,
        };
      });
      setRows(newRows);
      setShippingCost(Number(invoice.ov_freight || 0));
    }
  }, [trans_no, debtorTransList, debtorTransDetails, customers, branches, salesTypes, items, itemUnits, itemTaxTypes, navReference, navDate]);

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
          <PageTitle title={`Modifying Sales Invoice # ${trans_no || ""}`} />
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

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Cost Center"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              size="small"
            >
              <MenuItem value="">None</MenuItem>
              {costCenters.map((cc: any) => (
                <MenuItem key={cc.id} value={String(cc.id)}>
                  {cc.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>
      {/* Items Table */}
      <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center" }}>
        {selectedPaymentType === 1 ? "Sales Order Items" : "Invoice Items"}
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Item Code</TableCell>
              <TableCell>Description</TableCell>
              {selectedPaymentType !== 1 && <TableCell>Delivered</TableCell>}
              <TableCell>Units</TableCell>
              {selectedPaymentType === 1 && <TableCell>Quantity</TableCell>}
              <TableCell>Credited</TableCell>
              {selectedPaymentType !== 1 && <TableCell>This Invoice</TableCell>}
              {selectedPaymentType !== 1 && <TableCell>Price</TableCell>}
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
                {selectedPaymentType !== 1 && <TableCell>{row.delivered}</TableCell>}
                <TableCell>{row.units}</TableCell>
                {selectedPaymentType === 1 && <TableCell>{row.thisInvoice}</TableCell>}
                <TableCell>{row.invoiced}</TableCell>
                {selectedPaymentType !== 1 && (
                  <TableCell>
                    <FormattedNumberField
                      size="small"
                      value={row.thisInvoice}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        // Validate that quantity doesn't exceed delivered amount
                        if (value < 0) {
                          alert("Quantity cannot be negative");
                          return;
                        }
                        if (value > row.delivered) {
                          alert(`Quantity cannot exceed delivered amount (${row.delivered})`);
                          return;
                        }
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, thisInvoice: value, total: value * r.price } : r
                          )
                        );
                      }}
                      inputProps={{ min: 0, max: row.delivered }}
                    />
                  </TableCell>
                )}
                {selectedPaymentType !== 1 && <TableCell>{row.price}</TableCell>}
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
                  InputProps={selectedPaymentType === 1 ? { readOnly: true } : undefined}
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
                Invoice Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{invoiceTotal.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      {/* Memo and Actions */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        {selectedPaymentType === 1 && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sales Order"
                value={salesOrders.find(o => o.order_no === originalInvoice?.order_no)?.reference || ""}
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Payments Received"
                value={paymentRef}
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Invoiced Here"
                value={currentPaymentType === 1 ? 0 : invoiceTotal.toFixed(2)}
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={currentPaymentType === 1 ? "Left to be invoiced:" : "Invoiced so far:" }
                value={0}
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
          </Grid>
        )}
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
