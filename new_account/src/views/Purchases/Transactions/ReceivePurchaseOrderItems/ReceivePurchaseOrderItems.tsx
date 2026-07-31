import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import { getPurchOrderByOrderNo } from "../../../../api/PurchOrders/PurchOrderApi";
import { getPurchOrderDetailsByOrderNo } from "../../../../api/PurchOrders/PurchOrderDetailsApi";
import { getSuppliers } from "../../../../api/Supplier/SupplierApi";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { postGrnReceive, getPurchaseOrdersInquiry } from "../../../../api/Purchases/PurchasesApi";
import useCurrentUser from "../../../../hooks/useCurrentUser";
import { useNextFiscalYearReference } from "../../../../hooks/useNextFiscalYearReference";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { invalidateFinancialReports } from "../../../../utils/invalidateFinancialReports";
import { runTransactionSave } from "../../../../utils/transactionSave";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

function resolveLocCode(locations: any[], selected: string | number | null | undefined): string {
  if (selected === null || selected === undefined || selected === "") return "";
  const key = String(selected);
  const match = (locations || []).find(
    (l: any) =>
      String(l.id) === key ||
      String(l.loc_code ?? l.code ?? "") === key
  );
  return String(match?.loc_code ?? match?.code ?? key);
}

function locationSelectValue(loc: any): string {
  return String(loc.id ?? loc.loc_code ?? loc.code ?? "");
}

function mapDetailsToRows(
  orderDetails: any[],
  items: any[],
  itemUnits: any[]
): any[] {
  return (orderDetails || [])
    .map((d: any, idx: number) => {
      const stockId = d.item_code ?? d.stock_id ?? d.item ?? d.item_id ?? "";
      const itemRec = (items || []).find(
        (it: any) => String(it.stock_id ?? it.id ?? it.stockId) === String(stockId)
      );
      const unitId = d.unit ?? d.uom ?? itemRec?.units ?? itemRec?.unit ?? "";
      const unitObj = (itemUnits || []).find((u: any) => String(u.id) === String(unitId));
      const unitsDisplay = unitObj
        ? (unitObj.abbr ?? unitObj.name ?? String(unitId))
        : String(unitId ?? "");

      const orderedVal = Number(d.quantity_ordered ?? d.quantity ?? d.qty ?? 0);
      const receivedVal = Number(d.quantity_received ?? d.qty_received ?? 0);
      const outstandingVal = Math.max(0, orderedVal - receivedVal);
      const priceVal = Number(d.unit_price ?? d.unitPrice ?? d.act_price ?? d.price ?? 0) || 0;

      return {
        id: idx + 1,
        poDetailItem: Number(d.po_detail_item ?? d.po_detail_id ?? 0) || null,
        itemCode: stockId,
        description: d.description ?? d.desc ?? itemRec?.description ?? "",
        ordered: orderedVal,
        units: unitsDisplay,
        received: receivedVal,
        outstanding: outstandingVal,
        thisDelivery: outstandingVal,
        price: priceVal,
        total: priceVal * outstandingVal,
        deliveryDate: d.delivery_date ?? d.deliveryDate ?? null,
        detailSnapshot: d,
      };
    })
    .filter((row) => row.outstanding > 0);
}

export default function ReceivePurchaseOrderItems() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Purchase receive');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // === Form Fields ===
  const locationRouter = useLocation();
  const navigatedOrderNo =
    locationRouter.state?.id ??
    locationRouter.state?.orderNo ??
    locationRouter.state?.order_no ??
    null;

  const [pickedOrderNo, setPickedOrderNo] = useState<string>("");
  const activeOrderNo = navigatedOrderNo ?? (pickedOrderNo ? Number(pickedOrderNo) : null);

  const [supplier, setSupplier] = useState("");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [orderedOn, setOrderedOn] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [suppliersRef, setSuppliersRef] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderComments, setOrderComments] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split("T")[0]);

  const [dateReceivedError, setDateReceivedError] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  // Fiscal year queries
  const { data: fiscalYears = [] } = useQuery({ queryKey: ["fiscalYears"], queryFn: getFiscalYears });
  const { data: companyData } = useQuery({ queryKey: ["company"], queryFn: getCompanies });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: getSuppliers });
  const { user } = useCurrentUser();

  // Find selected fiscal year from company setup
  const selectedFiscalYear = useMemo(() => {
    if (!companyData || companyData.length === 0) return null;
    const company = companyData[0];
    return fiscalYears.find((fy: any) => fy.id === company.fiscal_year_id);
  }, [companyData, fiscalYears]);

  // Validate date is within fiscal year
  const validateDate = (selectedDate: string, setError: (error: string) => void) => {
    if (!selectedFiscalYear) {
      setError("No fiscal year selected from company setup");
      return false;
    }

    if (selectedFiscalYear.closed) {
      setError("The fiscal year is closed for further data entry.");
      return false;
    }

    const selected = new Date(selectedDate);
    const from = new Date(selectedFiscalYear.fiscal_year_from);
    const to = new Date(selectedFiscalYear.fiscal_year_to);

    if (selected < from || selected > to) {
      setError("The entered date is out of fiscal year.");
      return false;
    }

    setError("");
    return true;
  };

  // Validate dates when fiscal year is selected
  useEffect(() => {
    if (selectedFiscalYear) {
      validateDate(dateReceived, setDateReceivedError);
    }
  }, [selectedFiscalYear]);

  const { data: inventoryLocations = [] } = useQuery({ queryKey: ["inventoryLocations"], queryFn: getInventoryLocations });

  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: itemUnits = [] } = useQuery({ queryKey: ["itemUnits"], queryFn: getItemUnits });

  const { reference: nextGrnReference } = useNextFiscalYearReference(25, { asOfDate: dateReceived });

  const deliveryLocations = (inventoryLocations || []).map((l: any) => ({
    id: locationSelectValue(l),
    name: l.location_name ?? l.name ?? l.description ?? l.loc_code ?? String(l.id),
  }));

  useEffect(() => {
    if (!deliveryLocation && deliveryLocations && deliveryLocations.length > 0) {
      setDeliveryLocation(String(deliveryLocations[0].id));
    }
  }, [deliveryLocations]);

  const { data: outstandingOrders = [], isLoading: outstandingLoading } = useQuery({
    queryKey: ["outstandingPurchaseOrdersForReceive"],
    queryFn: () => getPurchaseOrdersInquiry({ outstanding: true, limit: 500 }),
    enabled: !navigatedOrderNo,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ["purchOrder", activeOrderNo],
    queryFn: () => getPurchOrderByOrderNo(activeOrderNo!),
    enabled: Boolean(activeOrderNo),
  });

  const { data: orderDetails = [], isLoading: detailsLoading, refetch: refetchOrderDetails } = useQuery({
    queryKey: ["purchOrderDetails", activeOrderNo],
    queryFn: () => getPurchOrderDetailsByOrderNo(activeOrderNo!),
    enabled: Boolean(activeOrderNo),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Populate header when order loads
  useEffect(() => {
    if (!orderData) return;

    const ord = orderData;
    setPurchaseOrder(String(ord.order_no ?? ord.id ?? ""));
    setOrderedOn(String((ord.ord_date ?? ord.ordDate ?? ord.date ?? new Date()).toString()).split("T")[0]);
    setSuppliersRef(ord.requisition_no ?? ord.requisitionNo ?? ord.supplier_ref ?? "");
    setDeliveryAddress(ord.delivery_address ?? ord.deliveryAddress ?? "");
    setOrderComments(ord.comments ?? ord.memo ?? ord.notes ?? "");

    const supRec = (suppliers || []).find(
      (s: any) =>
        String(s.supplier_id ?? s.id ?? s.debtor_no) ===
        String(ord.supplier_id ?? ord.supplier ?? ord.supp_id ?? "")
    );
    setSupplier(
      supRec
        ? (supRec.supp_name ?? supRec.name ?? supRec.supplier_name)
        : String(ord.supplier_id ?? ord.supplier ?? "")
    );
    setSupplierId(
      Number(ord.supplier_id ?? ord.supplier ?? ord.supp_id ?? supRec?.supplier_id ?? supRec?.id ?? null)
    );

    const intoLoc = ord.into_stock_location ?? ord.intoStockLocation ?? ord.into_location ?? null;
    if (intoLoc) {
      const matched = (inventoryLocations || []).find(
        (l: any) =>
          String(l.loc_code ?? l.code ?? "") === String(intoLoc) ||
          String(l.id) === String(intoLoc)
      );
      setDeliveryLocation(matched ? locationSelectValue(matched) : String(intoLoc));
    }
  }, [orderData, suppliers, inventoryLocations]);

  // === Table Data ===
  const [rows, setRows] = useState<any[]>([]);
  const [rowsInitialized, setRowsInitialized] = useState(false);

  useEffect(() => {
    setRowsInitialized(false);
    setRows([]);
  }, [activeOrderNo]);

  useEffect(() => {
    if (!activeOrderNo || detailsLoading) return;

    if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
      setRows([]);
      setRowsInitialized(true);
      return;
    }

    const mapped = mapDetailsToRows(orderDetails, items, itemUnits);
    setRows(mapped);
    setRowsInitialized(true);
  }, [activeOrderNo, orderDetails, detailsLoading, items, itemUnits]);

  useEffect(() => {
    if (nextGrnReference) {
      setReference(nextGrnReference);
    }
  }, [nextGrnReference]);

  const subTotal = rows.reduce(
    (sum, r) => sum + Number(r.thisDelivery || 0) * Number(r.price || 0),
    0
  );
  const amountTotal = subTotal;
  const isLoadingOrder = Boolean(activeOrderNo) && (orderLoading || detailsLoading);
  const showPickOrderMessage = !activeOrderNo;
  const showNoLinesMessage =
    Boolean(activeOrderNo) && rowsInitialized && !isLoadingOrder && rows.length === 0;

  const breadcrumbItems = [
    { title: "Purchases", href: "/purchases" },
    { title: "Receive Purchase Order Items" },
  ];

  const handleUpdate = () => {
    setRows((prev) =>
      prev.map((r) => {
        const capped = Math.min(Math.max(0, Number(r.thisDelivery) || 0), Number(r.outstanding) || 0);
        return { ...r, thisDelivery: capped, total: capped * Number(r.price || 0) };
      })
    );
  };

  const handleProcessReceive = async () => {
    setIsProcessing(true);
    try {
      if (!purchaseOrder) {
        alert("No purchase order loaded");
        return;
      }
      if (!supplierId) {
        alert("Missing supplier id");
        return;
      }
      if (!reference) {
        alert("Reference is not ready yet. Please wait a moment and try again.");
        return;
      }

      const locCode = resolveLocCode(inventoryLocations, deliveryLocation);
      if (!locCode) {
        alert("Select a delivery location");
        return;
      }

      const rowsToReceive = rows.filter((r) => Number(r.thisDelivery) > 0);
      if (rowsToReceive.length === 0) {
        alert("Enter a quantity to receive for at least one item.");
        return;
      }

      for (const row of rowsToReceive) {
        const qty = Number(row.thisDelivery);
        if (qty > Number(row.outstanding)) {
          alert(`Quantity for ${row.itemCode} exceeds outstanding (${row.outstanding}). Click Update to adjust.`);
          return;
        }
      }

      const details = await getPurchOrderDetailsByOrderNo(purchaseOrder);
      const receiveLines: Array<{ po_detail_item: number; quantity: number }> = [];

      for (const row of rowsToReceive) {
        const match =
          (details || []).find(
            (d: any) =>
              Number(d.po_detail_item) === Number(row.poDetailItem) ||
              String(d.item_code ?? d.stock_id ?? "") === String(row.itemCode)
          ) ?? row.detailSnapshot;

        const poItem = Number(row.poDetailItem ?? match?.po_detail_item ?? 0);
        if (!poItem) {
          throw new Error(`Purchase order line not found for item ${row.itemCode}`);
        }

        const ordered = Number(match?.quantity_ordered ?? row.ordered ?? 0);
        const received = Number(match?.quantity_received ?? row.received ?? 0);
        const remaining = Math.max(0, ordered - received);
        const requested = Number(row.thisDelivery);

        if (requested > remaining + 0.0001) {
          const refreshed = mapDetailsToRows(details || [], items, itemUnits);
          setRows(refreshed);
          alert(
            `Quantity for ${row.itemCode} exceeds outstanding (${remaining} remaining). ` +
              `Received was updated — adjust This Delivery and try again.`
          );
          return;
        }

        receiveLines.push({
          po_detail_item: poItem,
          quantity: requested,
        });
      }

      const saveResult = await runTransactionSave(() =>
        postGrnReceive({
          order_no: Number(purchaseOrder),
          reference,
          delivery_date: dateReceived,
          loc_code: locCode,
          lines: receiveLines,
        })
      );

      if (saveResult.ok === false) {
        if (/exceeds outstanding/i.test(saveResult.message)) {
          const { data: freshDetails = [] } = await refetchOrderDetails();
          setRows(mapDetailsToRows(freshDetails, items, itemUnits));
        }
        alert(saveResult.message);
        return;
      }

      const grnBatchId = saveResult.data.grn_batch_id;
      // build view items for success/view page
      const viewItems = (rowsToReceive || []).map((r: any) => {
        const qty = Number(r.thisDelivery || 0);
        const price = Number(r.price || 0);
        return {
          itemCode: r.itemCode,
          description: r.description,
          requiredBy: r.deliveryDate ?? orderedOn ?? dateReceived,
          quantity: qty,
          unit: r.units,
          price,
          lineTotal: qty * price,
          quantityInvoiced: Number(r.received || 0) + qty,
        };
      });

      const receivedSubtotal = viewItems.reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0
      );

      const successState = {
        reference,
        deliveryDate: dateReceived,
        date: dateReceived,
        deliveryAddress,
        supplierId: supplierId ?? null,
        deliverIntoLocation: locCode,
        suppliersReference: suppliersRef,
        purchaseOrderRef: purchaseOrder,
        orderNo: Number(purchaseOrder),
        grnBatchId,
        trans_type: 25,
        trans_no: grnBatchId,
        items: viewItems,
        subtotal: receivedSubtotal,
        totalAmount: receivedSubtotal,
        orderComments,
      };

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stockMoves"] }),
        queryClient.invalidateQueries({ queryKey: ["locStocks"] }),
        queryClient.invalidateQueries({ queryKey: ["grnBatches"] }),
        queryClient.invalidateQueries({ queryKey: ["grnItems"] }),
        queryClient.invalidateQueries({ queryKey: ["purchOrderDetails"] }),
      ]);
      invalidateFinancialReports(queryClient);

      alert("Purchase order items received successfully!");
      navigate("/purchase/transactions/receive-purchase-order-items/success", { state: successState });
    } catch (err) {
      console.error("Process receive failed", err);
      alert(getFriendlyApiErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

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
          <PageTitle title="Receive Purchase Order Items" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>
      {!navigatedOrderNo && (
        <Alert severity="info">
          Select an outstanding purchase order below, or open this screen from{" "}
          <strong>Outstanding Purchase Orders Maintenance</strong> (Receive button) or from the
          success page after entering a new PO.
        </Alert>
      )}
      {/* Form Section */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        {!navigatedOrderNo && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={8}>
              <TextField
                select
                fullWidth
                size="small"
                label="Outstanding Purchase Order"
                value={pickedOrderNo}
                onChange={(e) => setPickedOrderNo(e.target.value)}
                disabled={outstandingLoading}
                helperText={
                  outstandingLoading
                    ? "Loading outstanding orders…"
                    : outstandingOrders.length === 0
                      ? "No outstanding purchase orders — create a PO first or all lines are fully received."
                      : "Choose the PO you are receiving goods against."
                }
              >
                <MenuItem value="">
                  <em>Select purchase order…</em>
                </MenuItem>
                {(outstandingOrders as any[]).map((po) => (
                  <MenuItem key={po.order_no} value={String(po.order_no)}>
                    PO #{po.order_no} — {po.reference ?? ""} — {po.supplier_name ?? po.supplier_id}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: "flex", alignItems: "center" }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  navigate("/purchase/transactions/outstanding-purchase-orders-maintenance")
                }
              >
                Browse outstanding POs
              </Button>
            </Grid>
          </Grid>
        )}

        <Grid container spacing={2}>
          {/* Column 1: Supplier, For Purchase Order, Ordered On */}
          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Supplier"
                value={supplier}
                size="small"
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                label="For Purchase Order"
                value={purchaseOrder}
                size="small"
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                label="Ordered On"
                value={orderedOn}
                size="small"
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </Grid>

          {/* Column 2: Reference, Deliver Into Location, Date Items Received */}
          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Reference"
                value={reference}
                size="small"
                InputProps={{ readOnly: true }}
              />
              <TextField
                select
                fullWidth
                label="Deliver Into Location"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                size="small"
              >
                {deliveryLocations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                fullWidth
                label="Date Items Received"
                value={dateReceived}
                onChange={(e) => { setDateReceived(e.target.value); validateDate(e.target.value, setDateReceivedError); }}
                size="small"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_from).toISOString().split('T')[0] : undefined, max: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_to).toISOString().split('T')[0] : undefined, }}
                error={!!dateReceivedError}
                helperText={dateReceivedError}
              />
            </Stack>
          </Grid>

          {/* Column 3: Supplier's Reference & Delivery Address */}
          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Supplier's Reference"
                value={suppliersRef}
                size="small"
                InputProps={{ readOnly: true }}
              />

              <TextField
                fullWidth
                label="Delivery Address"
                value={deliveryAddress}
                size="small"
                InputProps={{ readOnly: true }}
              />

              <TextField
                fullWidth
                label="Order Comments"
                value={orderComments}
                size="small"
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>
      {/* Items Table */}
      <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center" }}>
        Items to Receive
      </Typography>
      <TableContainer component={Paper} sx={{ px: 2 }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Item Code</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Ordered</TableCell>
              <TableCell>Units</TableCell>
              <TableCell>Received</TableCell>
              <TableCell>Outstanding</TableCell>
              <TableCell>This Delivery</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {isLoadingOrder ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} sx={{ mr: 1, verticalAlign: "middle" }} />
                  Loading purchase order lines...
                </TableCell>
              </TableRow>
            ) : showPickOrderMessage ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  Select an outstanding purchase order above to load items to receive.
                </TableCell>
              </TableRow>
            ) : showNoLinesMessage ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  No outstanding items to receive for this purchase order (fully received).
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.itemCode}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell>{row.ordered}</TableCell>
                <TableCell>{row.units}</TableCell>
                <TableCell>{row.received}</TableCell>
                <TableCell>{row.outstanding}</TableCell>

                {/* Editable Quantity */}
                <TableCell>
                  <FormattedNumberField
                    size="small"
                    value={row.thisDelivery}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? { ...r, thisDelivery: value, total: value * r.price }
                            : r
                        )
                      );
                    }}
                  />
                </TableCell>

                <TableCell>{row.price}</TableCell>
                <TableCell>{row.total.toFixed(2)}</TableCell>
              </TableRow>
              ))
            )}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={9} sx={{ fontWeight: 600 }}>
                Sub Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                {subTotal.toFixed(2)}
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={9} sx={{ fontWeight: 600 }}>
                Amount Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                {amountTotal.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      {/* Buttons */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, pr: 2, mb: 4 }}>
        <Button variant="contained" color="primary" onClick={handleUpdate} disabled={!!dateReceivedError || isProcessing}>
          Update
        </Button>
        <Button variant="contained" color="success" onClick={handleProcessReceive} disabled={!!dateReceivedError || isProcessing || !reference || !canEdit}>
          {isProcessing ? (
            <>
              <CircularProgress size={18} sx={{ mr: 1, color: 'white' }} /> Processing...
            </>
          ) : (
            'Process Receive Items'
          )}
        </Button>
      </Box>
    </FormPageLayout>
  );
}
