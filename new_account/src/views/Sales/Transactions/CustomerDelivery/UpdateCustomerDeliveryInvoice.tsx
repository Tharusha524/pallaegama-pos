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
  CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getShippingCompanies } from "../../../../api/ShippingCompany/ShippingCompanyApi";
import { getDebtorTrans } from "../../../../api/DebtorTrans/DebtorTransApi";
import { getDebtorTransDetails } from "../../../../api/DebtorTrans/DebtorTransDetailsApi";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import { getSalesTypes } from "../../../../api/SalesMaintenance/salesService";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { getItemTaxTypes } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { updateDebtorTran } from "../../../../api/DebtorTrans/DebtorTransApi";
import { updateDebtorTransDetail } from "../../../../api/DebtorTrans/DebtorTransDetailsApi";
import { getSalesOrders, updateSalesOrder } from "../../../../api/SalesOrders/SalesOrdersApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import { useCustomerCredit } from "../../../../hooks/useCustomerCredit";
import CustomerCreditSummaryFields from "../../../../components/CustomerCreditSummaryFields";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function UpdateCustomerDeliveryInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales invoices edition');
  const navigate = useNavigate();
  const location = useLocation();
  const deliveryNo = location.state?.trans_no;

  // === State ===
  const [salesOrder, setSalesOrder] = useState<any>(null);
  const [orderDetails, setOrderDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // === Fields ===
  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState("");
  const [currency, setCurrency] = useState("");
  const [reference, setReference] = useState("");
  const [salesType, setSalesType] = useState("");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceDeadline, setInvoiceDeadline] = useState("");
  const [memo, setMemo] = useState("");
  const [balanceAction, setBalanceAction] = useState("");
  const [dateError, setDateError] = useState("");

  const [rows, setRows] = useState<any[]>([]);

  // === API Queries ===
  const { data: locations = [] } = useQuery({
    queryKey: ["inventoryLocations"],
    queryFn: getInventoryLocations,
  });

  const { data: shippingCompanies = [] } = useQuery({
    queryKey: ["shippingCompanies"],
    queryFn: getShippingCompanies,
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

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ["fiscalYears"],
    queryFn: getFiscalYears,
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

  const { data: debtorTrans = [] } = useQuery({
    queryKey: ["debtorTrans"],
    queryFn: getDebtorTrans,
  });

  const { data: allSalesOrders = [] } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: getSalesOrders,
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

  // Fetch delivery data
  useEffect(() => {
    const fetchData = async () => {
      if (!deliveryNo) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const delivery = debtorTrans.find((d: any) => String(d.trans_no) === String(deliveryNo) && d.trans_type === 13);
        if (delivery) {
          setSalesOrder(delivery);
          const details = await getDebtorTransDetails();
          const deliveryDetails = details.filter((dd: any) => dd.debtor_trans_no === delivery.trans_no && dd.debtor_trans_type === 13);
          setOrderDetails(deliveryDetails || []);
        }
      } catch (error) {
        console.error("Error fetching delivery data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (debtorTrans.length > 0) {
      fetchData();
    }
  }, [deliveryNo, debtorTrans]);

  // Set fields based on salesOrder
  useEffect(() => {
    if (salesOrder && customers.length > 0 && branches.length > 0 && salesTypes.length > 0 && allSalesOrders.length > 0) {
      const customerData = customers.find((c: any) => String(c.debtor_no) === String(salesOrder.debtor_no));
      const branchData = branches.find((b: any) => String(b.branch_code) === String(salesOrder.branch_code));
      const salesTypeData = salesTypes.find((st: any) => String(st.id) === String(salesOrder.tpe));
      const orderData = allSalesOrders.find((o: any) => String(o.order_no) === String(salesOrder.order_no));

      setCustomer(customerData?.name || "");
      setBranch(branchData?.br_name || "");
      setCurrency(customerData?.curr_code || "");
      setReference(salesOrder.reference || "");
      setSalesType(salesTypeData?.typeName || "");
      setDeliveryFrom(orderData?.from_stk_loc || "");
      setDate(salesOrder.tran_date ? salesOrder.tran_date.split(" ")[0] : new Date().toISOString().split("T")[0]);
      setInvoiceDeadline(salesOrder.due_date ? salesOrder.due_date.split(" ")[0] : "");
      setMemo(salesOrder.comments || "");
      setShippingCompany(String(salesOrder.ship_via) || "");
      setShippingCost(salesOrder.ov_freight || 0);
      // Validate date after setting
      const initialDate = salesOrder.tran_date ? salesOrder.tran_date.split(" ")[0] : new Date().toISOString().split("T")[0];
      validateDate(initialDate);
    }
  }, [salesOrder, customers, branches, salesTypes, allSalesOrders, selectedFiscalYear]);

  // Set rows from orderDetails
  useEffect(() => {
    if (orderDetails.length > 0 && items.length > 0 && itemUnits.length > 0 && itemTaxTypes.length > 0) {
      const newRows = orderDetails.map((detail: any, index: number) => {
        const itemData = items.find((i: any) => i.stock_id === detail.stock_id);
        const unitData = itemUnits.find((u: any) => u.id === itemData?.units);
        const unitName = unitData?.abbr || detail.units || "";
        const price = parseFloat(detail.unit_price || 0);
        const qty = parseFloat(detail.quantity || 0);
        const invoiceQty = parseFloat(detail.qty_done || 0);
        const remaining = Math.max(qty - invoiceQty, 0);
        const discountPercent = parseFloat(detail.discount_percent || 0);
        const discountedPrice = price * (1 - discountPercent / 100);
        const total = discountedPrice * remaining;
        const taxTypeData = itemTaxTypes.find((t: any) => String(t.id) === String(itemData?.tax_type_id));

        return {
          id: index + 1,
          detailId: detail.id,
          itemCode: detail.stock_id || "",
          description: detail.description || "",
          ordered: qty,
          units: unitName,
          deliveryQty: remaining, // default to remaining quantity
          invoice: invoiceQty, // invoiced quantity
          price: price,
          taxType: taxTypeData?.name || "VAT 15%",
          discount: discountPercent,
          total: total,
          deliveryError: "",
        };
      });
      setRows(newRows);
    }
  }, [orderDetails, items, itemUnits, itemTaxTypes]);

  // === Table totals ===
  const subTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const includedTax = subTotal * 0.15;
  const [shippingCost, setShippingCost] = useState(0);
  const amountTotal = subTotal + shippingCost;
  const documentTotal = subTotal + includedTax + shippingCost;

  const { summary: creditSummary, isLoading: creditLoading } = useCustomerCredit(
    salesOrder?.debtor_no ?? null,
    customers
  );

  const handleUpdate = async () => {
    console.log("handleUpdate called");
    if (!salesOrder || !deliveryNo) {
      alert("No delivery data available.");
      return;
    }

    try {
      const recordId = salesOrder.id ?? salesOrder.trans_no;
      await updateDebtorTran(recordId, {
        ov_freight: shippingCost,
        tran_date: date.includes(" ") ? date : `${date} 00:00:00`,
        due_date: invoiceDeadline
          ? invoiceDeadline.includes(" ")
            ? invoiceDeadline
            : `${invoiceDeadline} 00:00:00`
          : salesOrder.due_date,
      });

      const invalidRow = rows.find((r) => r.deliveryQty > Math.max(r.ordered - r.invoice, 0));
      if (invalidRow) {
        alert(`Delivery quantity for item ${invalidRow.itemCode} exceeds remaining quantity. Please correct it before updating.`);
        return;
      }
      const orderData = allSalesOrders.find((o: any) => String(o.order_no) === String(salesOrder.order_no));
      if (orderData) {
        await updateSalesOrder(orderData.order_no, { ...orderData, version: (orderData.version || 0) + 1 });
      }

      for (const row of rows) {
        const detailData = {
          debtor_trans_no: salesOrder.trans_no,
          debtor_trans_type: 13,
          stock_id: row.itemCode,
          description: row.description,
          quantity: row.deliveryQty,
          unit_price: row.price,
          discount_percent: row.discount,
          qty_done: row.deliveryQty,
          src_id: row.detailId,
        };
        await updateDebtorTransDetail(row.detailId, detailData);
      }

      alert("Delivery updated successfully!");
     // navigate("/sales/transactions/update-customer-delivery/success", { state: { deliveryNo, reference, date } });
    } catch (error) {
      console.error("Error updating delivery:", error);
      alert("Failed to update delivery. Please try again.");
    }
  };
  const handleClear = () => {
    setRows((prev) => prev.map((r) => ({ ...r, deliveryQty: 0 })));
  };
  const handleDispatch = async () => {
    await handleUpdate();
    navigate("/sales/transactions/update-customer-delivery/success", { state: { deliveryNo, reference, date } });
  };

  const breadcrumbItems = [
    { title: "Transactions", href: "/sales/transactions" },
    { title: `Modifying Delivery Note #${deliveryNo || ""}` },
  ];

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </Box>
    );
  }

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
          <PageTitle title={`Modifying Delivery Note #${deliveryNo || ""}`} />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>
      {/* Form */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2}>
          {/* Column 1 */}
          <Grid item xs={12} md={3}>
            <Stack spacing={2}>
              <TextField fullWidth label="Customer" value={customer} size="small" InputProps={{ readOnly: true }} />
              <TextField fullWidth label="Reference" value={reference} size="small" onChange={(e) => setReference(e.target.value)} />
              <TextField
                select
                fullWidth
                label="Delivery From"
                value={deliveryFrom}
                onChange={(e) => setDeliveryFrom(e.target.value)}
                size="small"
              >
                {locations.map((loc: any) => (
                  <MenuItem key={loc.loc_code} value={loc.loc_code}>
                    {loc.location_name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Grid>

          {/* Column 2 */}
          <Grid item xs={12} md={3}>
            <Stack spacing={2}>
              <TextField fullWidth label="Branch" value={branch} size="small" InputProps={{ readOnly: true }} />
              <TextField fullWidth label="Sales Order" value={salesOrder?.order_no || ""} size="small" InputProps={{ readOnly: true }} />
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
            </Stack>
          </Grid>

          {/* Column 3 */}
          <Grid item xs={12} md={3}>
            <Stack spacing={2}>
              <TextField fullWidth label="Currency" value={currency} size="small" InputProps={{ readOnly: true }} />
              <TextField fullWidth label="Sales Type" value={salesType} size="small" InputProps={{ readOnly: true }} />
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
            </Stack>
          </Grid>

          {/* Column 4 */}
          <Grid item xs={12} md={3}>
            <Stack spacing={2}>
              <CustomerCreditSummaryFields
                summary={creditSummary}
                documentTotal={documentTotal}
                isLoading={creditLoading}
              />
              <TextField fullWidth label="Cost Center" value="" size="small" InputProps={{ readOnly: true }} />
              <TextField
                type="date"
                label="Invoice Deadline"
                fullWidth
                size="small"
                value={invoiceDeadline}
                onChange={(e) => setInvoiceDeadline(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>
      {/* Items Table */}
      <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center" }}>
        Delivery Items
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Item Code</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Max. Delivery</TableCell>
              <TableCell>Units</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell>This Delivery</TableCell>
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
                <TableCell>{row.ordered}</TableCell>
                <TableCell>{row.units}</TableCell>
                <TableCell>{row.invoice}</TableCell>
                <TableCell>
                  <FormattedNumberField
                    size="small"
                    value={row.deliveryQty}
                    error={!!row.deliveryError}
                    helperText={row.deliveryError}
                    onChange={(e) => {
                      const input = e.target.value;
                      const value = Number(input);
                      setRows((prev) =>
                        prev.map((r) => {
                          if (r.id !== row.id) return r;
                          const maxAllowed = Math.max(r.ordered - r.invoice, 0);
                          const parsed = Number.isNaN(value) ? 0 : value;
                          const exceeded = parsed > maxAllowed;
                          const newValue = Math.max(0, Math.min(parsed, maxAllowed));
                          return {
                            ...r,
                            deliveryQty: newValue,
                            total: newValue * r.price,
                            deliveryError: exceeded ? `Maximum allowed: ${maxAllowed}` : "",
                          };
                        })
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
                Included Tax
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{includedTax.toFixed(2)}</TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={10} sx={{ fontWeight: 600 }}>
                Amount Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{amountTotal.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      {/* Actions + Memo */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Action for Balance"
              value={balanceAction}
              onChange={(e) => setBalanceAction(e.target.value)}
              size="small"
            >
              <MenuItem value="Back Order">Automatically put balance on back order</MenuItem>
              <MenuItem value="Cancel Balance">Cancel any quantities not delivered</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Memo"
              multiline
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
          <Button variant="contained" color="primary" onClick={handleUpdate} disabled={!!dateError}>
            Update
          </Button>
          <Button variant="outlined" color="warning" onClick={handleClear}>
            Clear Quantity
          </Button>
          <Button variant="contained" color="success" onClick={handleDispatch} disabled={!!dateError || !canEdit}>
            Process Dispatch
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
