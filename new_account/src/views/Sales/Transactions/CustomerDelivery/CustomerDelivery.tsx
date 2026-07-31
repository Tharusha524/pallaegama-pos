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
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getShippingCompanies } from "../../../../api/ShippingCompany/ShippingCompanyApi";
import { getSalesOrderByOrderNo, updateSalesOrder } from "../../../../api/SalesOrders/SalesOrdersApi";
import { getSalesOrderDetailsByOrderNo } from "../../../../api/SalesOrders/SalesOrderDetailsApi";
import { dispatchSalesDelivery } from "../../../../api/SalesDelivery/SalesDeliveryApi";
import { useNextFiscalYearReference } from "../../../../hooks/useNextFiscalYearReference";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import { getSalesTypes } from "../../../../api/SalesMaintenance/salesService";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { getItemTaxTypes } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { useCustomerCredit } from "../../../../hooks/useCustomerCredit";
import CustomerCreditSummaryFields from "../../../../components/CustomerCreditSummaryFields";
import { useTransactionMoney } from "../../../../hooks/useTransactionMoney";
import { useMessageDialog } from "../../../../context/MessageDialogContext";
import { runTransactionSave } from "../../../../utils/transactionSave";
import { getLocStocks } from "../../../../api/LocStock/LocStockApi";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function CustomerDelivery() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales orders edition');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation();
  const { showError } = useMessageDialog();
  const { orderNo } = state || {};

  // === State ===
  const [salesOrder, setSalesOrder] = useState<any>(null);
  const [orderDetails, setOrderDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // === Fields ===
  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState("");
  const [currency, setCurrency] = useState("");
  const { formatMoney } = useTransactionMoney(currency);
  const [reference, setReference] = useState("");
  const [salesOrderValue, setSalesOrderValue] = useState("");
  const [salesType, setSalesType] = useState("");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceDeadline, setInvoiceDeadline] = useState("");
  const [memo, setMemo] = useState("");
  const [balanceAction, setBalanceAction] = useState("");
  const [shippingCost, setShippingCost] = useState(0);

  const [rows, setRows] = useState<any[]>([]);

  const { reference: nextDeliveryReference } = useNextFiscalYearReference(13, {
    asOfDate: date,
    enabled: Boolean(salesOrder),
  });
  const deliveryReference = nextDeliveryReference;

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

  const { data: locStocks = [] } = useQuery({
    queryKey: ["locStocks"],
    queryFn: getLocStocks,
  });

  // Fetch sales order and details
  useEffect(() => {
    const fetchData = async () => {
      if (!orderNo) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [orderData, detailsData] = await Promise.all([
          getSalesOrderByOrderNo(orderNo),
          getSalesOrderDetailsByOrderNo(orderNo),
        ]);
        setSalesOrder(orderData);
        setOrderDetails(detailsData || []);
        if (!orderData) {
          showError(`Sales order #${orderNo} was not found.`, "Order not found");
        }
      } catch (error) {
        console.error("Error fetching sales order data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderNo]);

  // Set fields based on salesOrder
  useEffect(() => {
    if (salesOrder) {
      const customerData = customers.find((c: any) => String(c.debtor_no) === String(salesOrder.debtor_no));
      const branchData = branches.find((b: any) => String(b.branch_code) === String(salesOrder.branch_code));
      const salesTypeData = salesTypes.find((st: any) => String(st.id) === String(salesOrder.order_type));

      setCustomer(customerData?.name || "");
      setBranch(branchData?.br_name || "");
      setCurrency(customerData?.curr_code || "");
      setReference(salesOrder.reference || "");
      setSalesOrderValue(`${orderNo}`);
      setSalesType(salesTypeData?.typeName || "");
      setDeliveryFrom(salesOrder.from_stk_loc || "");
    }
  }, [salesOrder, customers, branches, salesTypes, orderNo]);

  // Set rows from orderDetails
  useEffect(() => {
    if (orderDetails.length > 0) {
      const newRows = orderDetails.map((detail: any, index: number) => {
        const itemData = items.find(
          (i: any) => String(i.stock_id) === String(detail.stk_code)
        );
        const unitData = itemUnits.find((u: any) => u.id === itemData?.units);
        const unitName = unitData?.abbr || detail.units || "";
        const price = parseFloat(detail.unit_price || 0);
        const qty = parseFloat(detail.quantity || 0);
        const qtySent = parseFloat(detail.qty_sent || 0);
        const remaining = Math.max(0, qty - qtySent);
        const discountPercent = parseFloat(detail.discount_percent || 0);
        const discountedPrice = price * (1 - discountPercent / 100);
        const taxTypeData = itemTaxTypes.find(
          (t: any) => String(t.id) === String(itemData?.tax_type_id)
        );
        const detailId = detail.id ?? detail.detail_id;
        const locCode = deliveryFrom || salesOrder?.from_stk_loc || "";
        const onHand = locStocks.find(
          (ls: any) =>
            String(ls.loc_code) === String(locCode) &&
            String(ls.stock_id) === String(detail.stk_code)
        );
        const availableQty = Number(onHand?.quantity ?? 0);

        return {
          id: index + 1,
          detailId,
          itemCode: detail.stk_code || "",
          description: detail.description || "",
          ordered: qty,
          delivered: qtySent,
          units: unitName,
          deliveryQty: remaining,
          availableQty,
          price: price,
          taxType: taxTypeData?.name || "VAT 15%",
          discount: discountPercent,
          total: remaining * discountedPrice,
        };
      });
      setRows(newRows);
    } else {
      setRows([]);
    }
  }, [orderDetails, items, itemUnits, itemTaxTypes, deliveryFrom, salesOrder?.from_stk_loc, locStocks]);

  const selectedSalesType = useMemo(
    () => salesTypes.find((st: any) => String(st.id) === String(salesOrder?.order_type)),
    [salesTypes, salesOrder]
  );
  const taxIncluded = Boolean(selectedSalesType?.taxIncl);

  const lineNetAmount = (row: { deliveryQty: number; price: number; discount: number }) =>
    row.deliveryQty * row.price * (1 - (row.discount || 0) / 100);

  const deliveryTotals = useMemo(() => {
    let sub = 0;
    let tax = 0;
    rows.forEach((row) => {
      const amount = lineNetAmount(row);
      sub += amount;
      const itemData = items.find((i: any) => String(i.stock_id) === String(row.itemCode));
      const taxTypeData = itemTaxTypes.find(
        (t: any) => String(t.id) === String(itemData?.tax_type_id)
      );
      const rate = Number(taxTypeData?.default_rate ?? 0) / 100;
      if (rate > 0) {
        tax += taxIncluded ? amount - amount / (1 + rate) : amount * rate;
      }
    });
    return { subTotal: sub, taxAmount: tax };
  }, [rows, items, itemTaxTypes, taxIncluded]);

  // === Table totals ===
  const subTotal = deliveryTotals.subTotal;
  const includedTax = deliveryTotals.taxAmount;
  const amountTotal = subTotal + (taxIncluded ? 0 : includedTax) + shippingCost;
  const dispatchDocumentTotal = amountTotal;

  const { summary: creditSummary, isLoading: creditLoading } = useCustomerCredit(
    salesOrder?.debtor_no ?? null,
    customers
  );

  const handleUpdate = async () => {
    if (!salesOrder || !orderNo) {
      alert("No sales order data available.");
      return;
    }

    const invalidRow = rows.find(
      (r) => r.deliveryQty > Math.max(0, (r.ordered ?? 0) - (r.delivered ?? 0))
    );
    if (invalidRow) {
      alert(
        `Delivery quantity for ${invalidRow.itemCode} exceeds remaining quantity.`
      );
      return;
    }

    try {
      await updateSalesOrder(orderNo, {
        ...salesOrder,
        ship_via: Number(shippingCompany) || salesOrder.ship_via || null,
        from_stk_loc: deliveryFrom || salesOrder.from_stk_loc,
        delivery_date: invoiceDeadline || salesOrder.delivery_date || date,
        freight_cost: shippingCost,
        comments: memo || salesOrder.comments || null,
        version: (Number(salesOrder.version) || 0) + 1,
      });
      setSalesOrder((prev: any) =>
        prev
          ? {
              ...prev,
              ship_via: Number(shippingCompany) || prev.ship_via,
              delivery_date: invoiceDeadline || prev.delivery_date,
              freight_cost: shippingCost,
              comments: memo || prev.comments,
              version: (Number(prev.version) || 0) + 1,
            }
          : prev
      );
      await queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      alert("Delivery details saved. Use Process Dispatch to post the delivery.");
    } catch (error) {
      console.error("Error updating delivery details:", error);
      alert("Failed to save delivery details.");
    }
  };
  const handleClear = () => {
    setRows((prev) => prev.map((r) => ({ ...r, deliveryQty: 0 })));
  };
  const handleDispatch = async () => {
    if (!salesOrder || !orderNo) {
      showError("Open this screen from Delivery Against Sales Orders and select an order.", "No sales order");
      return;
    }
    if (!deliveryFrom) {
      showError("Select a deliver-from location.", "Delivery location required");
      return;
    }

    const deliveredRows = rows.filter((r) => r.deliveryQty > 0);
    if (deliveredRows.length === 0) {
      showError(
        "Enter a delivery quantity on at least one line. If all lines show 0, this order may already be fully delivered.",
        "Nothing to deliver"
      );
      return;
    }

    const missingDetail = deliveredRows.find(
      (r) => !r.detailId || Number(r.detailId) <= 0
    );
    if (missingDetail) {
      showError(
        `Order line for ${missingDetail.itemCode} has no detail id. Re-open the order from Delivery Against Sales Orders.`,
        "Invalid order line"
      );
      return;
    }

    const overOrder = deliveredRows.find(
      (r) => r.deliveryQty > Math.max(0, (r.ordered ?? 0) - (r.delivered ?? 0)) + 0.0001
    );
    if (overOrder) {
      showError(
        `Delivery quantity for ${overOrder.itemCode} exceeds the remaining order quantity.`,
        "Quantity too high"
      );
      return;
    }

    const overStock = deliveredRows.find(
      (r) => r.deliveryQty > r.availableQty + 0.0001
    );
    if (overStock) {
      showError(
        `Insufficient stock for ${overStock.itemCode} at ${deliveryFrom}. On hand: ${overStock.availableQty}, requested: ${overStock.deliveryQty}.`,
        "Insufficient stock"
      );
      return;
    }

    const saveResult = await runTransactionSave(async () => {
      const result = await dispatchSalesDelivery({
        order_no: Number(orderNo),
        tran_date: date,
        due_date: invoiceDeadline || date,
        ship_via: Number(shippingCompany) || Number(salesOrder.ship_via) || null,
        freight_cost: shippingCost,
        comments: memo || undefined,
        close_order: balanceAction === "Cancel Balance",
        reference: deliveryReference || undefined,
        from_stk_loc: deliveryFrom,
        lines: deliveredRows.map((row) => ({
          sales_order_detail_id: Number(row.detailId),
          quantity: Number(row.deliveryQty),
        })),
      });

      if (result.gl_warning) {
        console.warn("Delivery GL warning:", result.gl_warning);
      }

      await queryClient.invalidateQueries({
        queryKey: ["customerCreditSummary", salesOrder.debtor_no],
      });
      await queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      await queryClient.invalidateQueries({ queryKey: ["debtorTrans"] });
      await queryClient.invalidateQueries({ queryKey: ["locStocks"] });

      return {
        transNo: result.trans_no,
        reference: result.reference ?? deliveryReference,
        date,
        trans_type: 13,
        orderNo,
      };
    });

    if (saveResult.ok === false) {
      showError(saveResult.message, "Dispatch failed");
      return;
    }

    navigate("/sales/transactions/customer-delivery/success", {
      state: saveResult.data,
    });
  };

  const breadcrumbItems = [
    { title: "Transactions", href: "/sales/transactions" },
    { title: `Deliver Items for Sales Order #${orderNo || ""}` },
  ];

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!orderNo) {
    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        <Alert severity="warning">
          No sales order was selected. Go to <strong>Delivery Against Sales Orders</strong>, pick an order, and click <strong>Dispatch</strong>.
        </Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/sales/transactions/delivery-against-sales-orders")}>
          Back to Delivery Against Sales Orders
        </Button>
      </Stack>
    );
  }

  if (!salesOrder) {
    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        <Alert severity="error">
          Sales order #{orderNo} could not be loaded. It may have been deleted or the order number is wrong.
        </Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/sales/transactions/delivery-against-sales-orders")}>
          Back to Delivery Against Sales Orders
        </Button>
      </Stack>
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
          <PageTitle title="Deliver Items for a Sales Order" />
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
          <Grid item xs={3}>
            <TextField fullWidth label="Customer" value={customer} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={3}>
            <TextField fullWidth label="Reference" value={deliveryReference} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={3}>
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
          </Grid>

          {/* Column 2 */}
          <Grid item xs={3}>
            <TextField fullWidth label="Branch" value={branch} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={3}>
            <TextField fullWidth label="For Sales Order" value={salesOrderValue} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={3}>
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

          {/* Column 3 */}
          <Grid item xs={3}>
            <TextField fullWidth label="Currency" value={currency} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={3}>
            <TextField fullWidth label="Sales Type" value={salesType} size="small" InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={3}>
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

          {/* Column 4 */}
          <Grid item xs={3}>
            <CustomerCreditSummaryFields
              summary={creditSummary}
              documentTotal={dispatchDocumentTotal}
              isLoading={creditLoading}
              currencyCode={currency}
            />
          </Grid>

          <Grid item xs={3}>
            <TextField
              type="date"
              label="Invoice Deadline"
              fullWidth
              size="small"
              value={invoiceDeadline}
              onChange={(e) => setInvoiceDeadline(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
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
                <TableCell>Ordered</TableCell>
                <TableCell>Delivered</TableCell>
                <TableCell>Units</TableCell>
                <TableCell>On Hand</TableCell>
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
                <TableCell>{row.delivered}</TableCell>
                <TableCell>{row.units}</TableCell>
                <TableCell>{row.availableQty ?? 0}</TableCell>
                <TableCell>
                  <FormattedNumberField
                    size="small"
                    value={row.deliveryQty}
                    onChange={(e) => {
                      const maxOrder = Math.max(0, (row.ordered ?? 0) - (row.delivered ?? 0));
                      const maxStock =
                        row.availableQty > 0 ? Math.min(maxOrder, row.availableQty) : maxOrder;
                      const value = Math.max(0, Math.min(Number(e.target.value), maxStock));
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? {
                                ...r,
                                deliveryQty: value,
                                total: value * r.price * (1 - (r.discount || 0) / 100),
                              }
                            : r
                        )
                      );
                    }}
                    inputProps={{ min: 0, max: Math.max(0, (row.ordered ?? 0) - (row.delivered ?? 0)) }}
                    helperText={
                      row.availableQty > 0 && row.deliveryQty > row.availableQty
                        ? "Exceeds stock"
                        : undefined
                    }
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
                Included Tax
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{formatMoney(includedTax)}</TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={10} sx={{ fontWeight: 600 }}>
                Amount Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{formatMoney(amountTotal)}</TableCell>
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
          <Button variant="contained" color="primary" onClick={handleUpdate}>
            Update
          </Button>
          <Button variant="outlined" color="warning" onClick={handleClear}>
            Clear Quantity
          </Button>
          <Button disabled={!canEdit} variant="contained" color="success" onClick={handleDispatch}>
            Process Dispatch
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
