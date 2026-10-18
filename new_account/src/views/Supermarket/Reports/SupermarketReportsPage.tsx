import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Typography, Card, CardContent, Stack, TextField, FormControl, InputLabel, Select, MenuItem,
  Autocomplete, Chip,
} from "@mui/material";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import {
  getVelocityAndDemand, getDeadStock, getProductProfit, getBusinessActivity, getValuation,
  getNegativeStock, getVoucherLiability, getReceivablesAging, getPayablesAging, getSalesByCashierShift,
  getVoidReport, getPriceOverrideAudit, getSupplierItemList,
} from "../../../api/Pos/posAdvancedApi";
import { getSuppliers } from "../../../api/Supplier/SupplierApi";
import { getLowestCostBySupplier } from "../../../api/Pos/posApi";
import { getStockMoveHistory } from "../../../api/StockMoves/StockMovesApi";
import { getItems, getExpiryList } from "../../../api/Item/ItemApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

// Full-width report tables with balanced columns: the first column (product /
// date) takes the largest share, the rest split the remaining space evenly.
const reportTableLayout = {
  "& .MuiTableContainer-root": { width: "100%", overflowX: "auto" },
  "& .MuiTable-root": { width: "100%" },
  "& .MuiTableCell-root": { px: 3 },
  "& .MuiTableRow-root > .MuiTableCell-root:first-of-type": { width: "40%" },
  "& .MuiTableCell-head": { whiteSpace: "nowrap" },
  "& .MuiTableCell-alignRight": { whiteSpace: "nowrap" },
};

export default function SupermarketReportsPage() {
  const { formatCurrency } = useHomeCurrency();
  const [tab, setTab] = useState("velocity");
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [locCode, setLocCode] = useState("");

  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  const { data: velocity, isLoading: l1 } = useQuery({
    queryKey: ["velocity-demand", fromDate, toDate], queryFn: () => getVelocityAndDemand({ from_date: fromDate, to_date: toDate }), enabled: tab === "velocity",
  });
  const { data: deadStock, isLoading: l2 } = useQuery({
    queryKey: ["dead-stock", locCode], queryFn: () => getDeadStock(90, locCode || undefined), enabled: tab === "dead-stock",
  });
  const { data: profit, isLoading: l3 } = useQuery({
    queryKey: ["product-profit", fromDate, toDate], queryFn: () => getProductProfit({ from_date: fromDate, to_date: toDate }), enabled: tab === "profit",
  });
  const { data: activity, isLoading: l4 } = useQuery({
    queryKey: ["business-activity", fromDate, toDate], queryFn: () => getBusinessActivity({ from_date: fromDate, to_date: toDate }), enabled: tab === "activity",
  });
  const { data: valuation, isLoading: l5 } = useQuery({
    queryKey: ["valuation", locCode], queryFn: () => getValuation(locCode || undefined), enabled: tab === "valuation",
  });

  const { data: lowestCost, isLoading: l6 } = useQuery({
    queryKey: ["lowest-cost-by-supplier"], queryFn: () => getLowestCostBySupplier(), enabled: tab === "lowest-cost",
  });

  const { data: negativeStock, isLoading: l8 } = useQuery({
    queryKey: ["negative-stock", locCode], queryFn: () => getNegativeStock(locCode || undefined), enabled: tab === "negative-stock",
  });
  const { data: voucherLiability, isLoading: l9 } = useQuery({
    queryKey: ["voucher-liability"], queryFn: getVoucherLiability, enabled: tab === "voucher-liability",
  });
  const { data: receivablesAging, isLoading: l10 } = useQuery({
    queryKey: ["receivables-aging"], queryFn: getReceivablesAging, enabled: tab === "receivables-aging",
  });
  const { data: payablesAging, isLoading: l11 } = useQuery({
    queryKey: ["payables-aging"], queryFn: getPayablesAging, enabled: tab === "payables-aging",
  });
  const { data: cashierShift, isLoading: l12 } = useQuery({
    queryKey: ["sales-by-cashier-shift", fromDate, toDate],
    queryFn: () => getSalesByCashierShift({ from_date: fromDate, to_date: toDate }),
    enabled: tab === "cashier-shift",
  });
  const { data: expiryList, isLoading: l13 } = useQuery({
    queryKey: ["expiry-list"], queryFn: () => getExpiryList(90), enabled: tab === "expiry-list",
  });
  const { data: voidReport, isLoading: l14 } = useQuery({
    queryKey: ["void-report", fromDate, toDate],
    queryFn: () => getVoidReport({ from_date: fromDate, to_date: toDate }),
    enabled: tab === "void-report",
  });
  const { data: priceOverrides, isLoading: l15 } = useQuery({
    queryKey: ["price-override-audit", fromDate, toDate],
    queryFn: () => getPriceOverrideAudit({ from_date: fromDate, to_date: toDate }),
    enabled: tab === "price-override-audit",
  });
  const [supplierFilter, setSupplierFilter] = useState("");
  const { data: suppliersList } = useQuery({ queryKey: ["suppliers-all"], queryFn: getSuppliers, enabled: tab === "supplier-item-list" });
  const { data: supplierItems, isLoading: l16 } = useQuery({
    queryKey: ["supplier-item-list", supplierFilter],
    queryFn: () => getSupplierItemList(supplierFilter || undefined),
    enabled: tab === "supplier-item-list",
  });

  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems, enabled: tab === "stock-history" });
  const [historyProduct, setHistoryProduct] = useState<any>(null);
  const { data: stockHistory, isLoading: l7 } = useQuery({
    queryKey: ["stock-move-history", historyProduct?.stock_id],
    queryFn: () => getStockMoveHistory(historyProduct.stock_id),
    enabled: tab === "stock-history" && !!historyProduct,
  });

  return (
    <FormPageLayout>
      <Box sx={reportTableLayout}>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Supermarket Reports" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Reports" }]} />
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField label="From" type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        {(tab === "dead-stock" || tab === "valuation") && locations && locations.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Branch / Location</InputLabel>
            <Select value={locCode} label="Branch / Location" onChange={(e) => setLocCode(e.target.value)}>
              <MenuItem value="">All Locations</MenuItem>
              {locations.map((loc: any) => (
                <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {tab === "supplier-item-list" && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Supplier</InputLabel>
            <Select value={supplierFilter} label="Supplier" onChange={(e) => setSupplierFilter(e.target.value)}>
              <MenuItem value="">All Suppliers</MenuItem>
              {(suppliersList ?? []).map((s: any) => (
                <MenuItem key={s.supplier_id} value={s.supplier_id}>{s.supp_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab label="Velocity & Demand" value="velocity" />
        <Tab label="Dead Stock" value="dead-stock" />
        <Tab label="Product Profit" value="profit" />
        <Tab label="Business Activity" value="activity" />
        <Tab label="Valuation" value="valuation" />
        <Tab label="Lowest Cost Supplier" value="lowest-cost" />
        <Tab label="Stock History" value="stock-history" />
        <Tab label="Negative Stock" value="negative-stock" />
        <Tab label="Voucher Liability" value="voucher-liability" />
        <Tab label="Receivables Aging" value="receivables-aging" />
        <Tab label="Payables Aging" value="payables-aging" />
        <Tab label="Sales by Cashier/Shift" value="cashier-shift" />
        <Tab label="Expiry List" value="expiry-list" />
        <Tab label="Void Report" value="void-report" />
        <Tab label="Price Override Audit" value="price-override-audit" />
        <Tab label="Supplier Item List" value="supplier-item-list" />
      </Tabs>

      {tab === "velocity" && (l1 ? <PageLoader /> : (
        <Stack spacing={2}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Fast Moving</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Units Sold</TableCell><TableCell align="right">Avg/Day</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                <TableBody>
                  {(velocity?.fast_moving ?? []).map((r: any) => (
                    <TableRow key={r.stock_id}><TableCell>{r.description}</TableCell><TableCell align="right">{r.units_sold}</TableCell><TableCell align="right">{r.avg_per_day}</TableCell><TableCell align="right">{formatCurrency(r.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table></TableContainer>
            </CardContent>
          </Card>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Slow Moving</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Units Sold</TableCell><TableCell align="right">Avg/Day</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                <TableBody>
                  {(velocity?.slow_moving ?? []).map((r: any) => (
                    <TableRow key={r.stock_id}><TableCell>{r.description}</TableCell><TableCell align="right">{r.units_sold}</TableCell><TableCell align="right">{r.avg_per_day}</TableCell><TableCell align="right">{formatCurrency(r.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table></TableContainer>
            </CardContent>
          </Card>
        </Stack>
      ))}

      {tab === "dead-stock" && (l2 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}><TableRow><TableCell>Product</TableCell><TableCell>Location</TableCell><TableCell align="right">On Hand</TableCell></TableRow></TableHead>
            <TableBody>
              {(deadStock ?? []).map((r: any, i: number) => (
                <TableRow key={i}><TableCell>{r.description}</TableCell><TableCell>{r.loc_code}</TableCell><TableCell align="right">{r.quantity}</TableCell></TableRow>
              ))}
              {(!deadStock || deadStock.length === 0) && <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">No dead stock — everything has sold recently.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "profit" && (l3 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow><TableCell>Product</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Revenue</TableCell><TableCell align="right">Cost</TableCell><TableCell align="right">Profit</TableCell><TableCell align="right">Margin %</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(profit ?? []).map((r: any) => (
                <TableRow key={r.stock_id}>
                  <TableCell>{r.description}</TableCell><TableCell align="right">{r.units_sold}</TableCell>
                  <TableCell align="right">{formatCurrency(r.revenue)}</TableCell><TableCell align="right">{formatCurrency(r.cost)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.gross_profit)}</TableCell><TableCell align="right">{r.margin_percent}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "activity" && (l4 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}><TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Ref</TableCell><TableCell>Party</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
            <TableBody>
              {(activity ?? []).map((a: any, i: number) => (
                <TableRow key={i}><TableCell>{a.date}</TableCell><TableCell>{a.type}</TableCell><TableCell>{a.ref}</TableCell><TableCell>{a.party}</TableCell><TableCell align="right">{formatCurrency(a.amount)}</TableCell></TableRow>
              ))}
              {(!activity || activity.length === 0) && <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No activity in this period.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "valuation" && (l5 ? <PageLoader /> : (
        <Box>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2, display: "inline-block", px: 3, py: 2 }}>
            <Typography variant="caption" color="text.secondary">TOTAL INVENTORY VALUE</Typography>
            <Typography variant="h5" fontWeight={800}>{formatCurrency(valuation?.total_value ?? 0)}</Typography>
          </Card>
          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}><TableRow><TableCell>Product</TableCell><TableCell>Location</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Unit Cost</TableCell><TableCell align="right">Value</TableCell></TableRow></TableHead>
              <TableBody>
                {(valuation?.items ?? []).map((r: any, i: number) => (
                  <TableRow key={i}><TableCell>{r.description}</TableCell><TableCell>{r.loc_code}</TableCell><TableCell align="right">{r.quantity}</TableCell><TableCell align="right">{formatCurrency(r.purchase_cost)}</TableCell><TableCell align="right">{formatCurrency(r.value)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      {tab === "lowest-cost" && (l6 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow><TableCell>Product</TableCell><TableCell>Best Supplier</TableCell><TableCell align="right">Lowest Price Paid</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(lowestCost ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{r.description ? `${r.stock_id} — ${r.description}` : r.stock_id}</TableCell>
                  <TableCell>{r.supplier_name}</TableCell>
                  <TableCell align="right">{formatCurrency(r.lowest_price)}</TableCell>
                </TableRow>
              ))}
              {(!lowestCost || lowestCost.length === 0) && (
                <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">No supplier invoices recorded yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "stock-history" && (
        <Stack spacing={2}>
          <Autocomplete
            sx={{ maxWidth: 400 }}
            options={items ?? []}
            getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
            value={historyProduct}
            onChange={(_, v) => setHistoryProduct(v)}
            renderInput={(p) => <TextField {...p} label="Search Product" size="small" />}
          />
          {!historyProduct ? (
            <Typography variant="body2" color="text.secondary">Pick a product to see its stock movement history.</Typography>
          ) : l7 ? <PageLoader /> : (
            <TableContainer component={Paper} elevation={2}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                  <TableRow><TableCell>Date</TableCell><TableCell>Location</TableCell><TableCell>Reference</TableCell><TableCell align="right">Qty Change</TableCell><TableCell align="right">Price</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {(stockHistory ?? []).map((r: any) => (
                    <TableRow key={r.trans_id}>
                      <TableCell>{r.tran_date}</TableCell>
                      <TableCell>{r.loc_code}</TableCell>
                      <TableCell>{r.reference}</TableCell>
                      <TableCell align="right" sx={{ color: r.qty >= 0 ? "success.main" : "error.main" }}>{r.qty >= 0 ? "+" : ""}{r.qty}</TableCell>
                      <TableCell align="right">{formatCurrency(r.price)}</TableCell>
                    </TableRow>
                  ))}
                  {(!stockHistory || stockHistory.length === 0) && (
                    <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No movement history for this product.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )}

      {tab === "negative-stock" && (l8 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow><TableCell>Product</TableCell><TableCell>Location</TableCell><TableCell align="right">Quantity</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(negativeStock ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{r.loc_code}</TableCell>
                  <TableCell align="right" sx={{ color: "error.main", fontWeight: 700 }}>{r.quantity}</TableCell>
                </TableRow>
              ))}
              {(!negativeStock || negativeStock.length === 0) && (
                <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">No negative-stock items — everything is at or above zero.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "voucher-liability" && (l9 ? <PageLoader /> : (
        <Box>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2, display: "inline-block", px: 3, py: 2 }}>
            <Typography variant="caption" color="text.secondary">TOTAL OUTSTANDING VOUCHER LIABILITY</Typography>
            <Typography variant="h5" fontWeight={800}>{formatCurrency(voucherLiability?.total_outstanding ?? 0)}</Typography>
          </Card>
          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                <TableRow><TableCell>Voucher Code</TableCell><TableCell align="right">Face Value</TableCell><TableCell align="right">Balance</TableCell><TableCell>Issued</TableCell><TableCell>Expires</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {(voucherLiability?.vouchers ?? []).map((v: any) => (
                  <TableRow key={v.voucher_code}>
                    <TableCell>{v.voucher_code}</TableCell>
                    <TableCell align="right">{formatCurrency(v.face_value)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(v.balance)}</TableCell>
                    <TableCell>{v.issue_date}</TableCell>
                    <TableCell>{v.expiry_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {(!voucherLiability?.vouchers || voucherLiability.vouchers.length === 0) && (
                  <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No outstanding vouchers.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      {tab === "receivables-aging" && (l10 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Customer</TableCell><TableCell align="right">Current</TableCell><TableCell align="right">1-30 Days</TableCell>
                <TableCell align="right">31-60 Days</TableCell><TableCell align="right">61-90 Days</TableCell><TableCell align="right">90+ Days</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(receivablesAging ?? []).map((r: any) => (
                <TableRow key={r.party_id}>
                  <TableCell>{r.party_name}</TableCell>
                  <TableCell align="right">{formatCurrency(r.current)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.days_1_30)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.days_31_60)}</TableCell>
                  <TableCell align="right" sx={{ color: r.days_61_90 > 0 ? "warning.main" : undefined }}>{formatCurrency(r.days_61_90)}</TableCell>
                  <TableCell align="right" sx={{ color: r.days_over_90 > 0 ? "error.main" : undefined }}>{formatCurrency(r.days_over_90)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(r.total_outstanding)}</TableCell>
                </TableRow>
              ))}
              {(!receivablesAging || receivablesAging.length === 0) && (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2">No outstanding customer balances.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "payables-aging" && (l11 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Supplier</TableCell><TableCell align="right">Current</TableCell><TableCell align="right">1-30 Days</TableCell>
                <TableCell align="right">31-60 Days</TableCell><TableCell align="right">61-90 Days</TableCell><TableCell align="right">90+ Days</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(payablesAging ?? []).map((r: any) => (
                <TableRow key={r.party_id}>
                  <TableCell>{r.party_name}</TableCell>
                  <TableCell align="right">{formatCurrency(r.current)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.days_1_30)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.days_31_60)}</TableCell>
                  <TableCell align="right" sx={{ color: r.days_61_90 > 0 ? "warning.main" : undefined }}>{formatCurrency(r.days_61_90)}</TableCell>
                  <TableCell align="right" sx={{ color: r.days_over_90 > 0 ? "error.main" : undefined }}>{formatCurrency(r.days_over_90)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(r.total_outstanding)}</TableCell>
                </TableRow>
              ))}
              {(!payablesAging || payablesAging.length === 0) && (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2">No outstanding supplier balances.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "cashier-shift" && (l12 ? <PageLoader /> : (
        <Stack spacing={2}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Sales by Cashier</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell>Cashier</TableCell><TableCell align="right">Bills</TableCell><TableCell align="right">Total Sales</TableCell></TableRow></TableHead>
                <TableBody>
                  {(cashierShift?.by_cashier ?? []).map((r: any) => (
                    <TableRow key={r.user_id}>
                      <TableCell>{r.cashier_name}</TableCell>
                      <TableCell align="right">{r.bill_count}</TableCell>
                      <TableCell align="right">{formatCurrency(r.total_sales)}</TableCell>
                    </TableRow>
                  ))}
                  {(!cashierShift?.by_cashier || cashierShift.by_cashier.length === 0) && (
                    <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">No shift-tagged sales in this period.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table></TableContainer>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Sales by Shift</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell>Cashier</TableCell><TableCell>Shift Start</TableCell><TableCell>Shift End</TableCell><TableCell>Status</TableCell><TableCell align="right">Bills</TableCell><TableCell align="right">Total Sales</TableCell></TableRow></TableHead>
                <TableBody>
                  {(cashierShift?.by_shift ?? []).map((r: any) => (
                    <TableRow key={r.shift_id}>
                      <TableCell>{r.cashier_name}</TableCell>
                      <TableCell>{r.shift_start}</TableCell>
                      <TableCell>{r.shift_end ?? "—"}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell align="right">{r.bill_count}</TableCell>
                      <TableCell align="right">{formatCurrency(r.total_sales)}</TableCell>
                    </TableRow>
                  ))}
                  {(!cashierShift?.by_shift || cashierShift.by_shift.length === 0) && (
                    <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No shifts recorded in this period.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table></TableContainer>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Sales by Hour of Day</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell>Hour</TableCell><TableCell align="right">Bills</TableCell><TableCell align="right">Total Sales</TableCell></TableRow></TableHead>
                <TableBody>
                  {(cashierShift?.by_hour ?? []).map((r: any) => (
                    <TableRow key={r.hour}>
                      <TableCell>{String(r.hour).padStart(2, "0")}:00</TableCell>
                      <TableCell align="right">{r.bill_count}</TableCell>
                      <TableCell align="right">{formatCurrency(r.total_sales)}</TableCell>
                    </TableRow>
                  ))}
                  {(!cashierShift?.by_hour || cashierShift.by_hour.length === 0) && (
                    <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">No sales in this period.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table></TableContainer>
            </CardContent>
          </Card>
        </Stack>
      ))}

      {tab === "expiry-list" && (l13 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow><TableCell>Product</TableCell><TableCell>Expiry Date</TableCell><TableCell>Status</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(expiryList ?? []).map((r: any) => (
                <TableRow key={r.stock_id}>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{r.expiry_date}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={r.status === "expired" ? "Expired" : "Expiring Soon"}
                      color={r.status === "expired" ? "error" : "warning"}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {(!expiryList || expiryList.length === 0) && (
                <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2">Nothing expiring in the next 90 days.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "void-report" && (l14 ? <PageLoader /> : (
        <Box>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2, display: "inline-block", px: 3, py: 2 }}>
            <Typography variant="caption" color="text.secondary">TOTAL VOIDED AMOUNT</Typography>
            <Typography variant="h5" fontWeight={800}>{formatCurrency(voidReport?.total_voided_amount ?? 0)}</Typography>
          </Card>
          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                <TableRow><TableCell>Invoice #</TableCell><TableCell>Customer</TableCell><TableCell align="right">Amount</TableCell><TableCell>Reason</TableCell><TableCell>Voided By</TableCell><TableCell>Voided At</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {(voidReport?.voids ?? []).map((v: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{v.trans_no}</TableCell>
                    <TableCell>{v.customer_name ?? "—"}</TableCell>
                    <TableCell align="right">{formatCurrency(v.amount)}</TableCell>
                    <TableCell>{v.memo ?? "—"}</TableCell>
                    <TableCell>{v.voided_by_name ?? "—"}</TableCell>
                    <TableCell>{v.voided_at}</TableCell>
                  </TableRow>
                ))}
                {(!voidReport?.voids || voidReport.voids.length === 0) && (
                  <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No voided sales in this period.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      {tab === "price-override-audit" && (l15 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow><TableCell>Invoice #</TableCell><TableCell>Product</TableCell><TableCell align="right">Original Price</TableCell><TableCell align="right">New Price</TableCell><TableCell>Cashier</TableCell><TableCell>When</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(priceOverrides ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{r.debtor_trans_no}</TableCell>
                  <TableCell>{r.description ?? "—"}</TableCell>
                  <TableCell align="right">{formatCurrency(r.original_price)}</TableCell>
                  <TableCell align="right" sx={{ color: r.new_price < r.original_price ? "warning.main" : "success.main", fontWeight: 700 }}>
                    {formatCurrency(r.new_price)}
                  </TableCell>
                  <TableCell>{r.cashier_name ?? "—"}</TableCell>
                  <TableCell>{r.created_at}</TableCell>
                </TableRow>
              ))}
              {(!priceOverrides || priceOverrides.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No manual price overrides in this period.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {tab === "supplier-item-list" && (l16 ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow><TableCell>Supplier</TableCell><TableCell>Product</TableCell><TableCell align="right">Price</TableCell><TableCell>Supplier UOM</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(supplierItems ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{r.supp_name}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell align="right">{formatCurrency(r.price)}</TableCell>
                  <TableCell>{r.suppliers_uom ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(!supplierItems || supplierItems.length === 0) && (
                <TableRow><TableCell colSpan={4} align="center"><Typography variant="body2">No supplier item pricing on file.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ))}
      </Box>
    </FormPageLayout>
  );
}
