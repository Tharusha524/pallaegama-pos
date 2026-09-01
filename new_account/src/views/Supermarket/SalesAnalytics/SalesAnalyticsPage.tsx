import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, TextField, Stack, Chip,
} from "@mui/material";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import {
  getSupermarketDashboardSummary, getProductPerformance, getSalesTrend, getTopCustomers,
} from "../../../api/Pos/posApi";
import { getBestSuppliers } from "../../../api/Pos/posApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

export default function SalesAnalyticsPage() {
  const { formatCurrency } = useHomeCurrency();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["supermarket-dashboard-summary"],
    queryFn: getSupermarketDashboardSummary,
  });

  const { data: perf, isLoading: loadingPerf } = useQuery({
    queryKey: ["product-performance", fromDate, toDate],
    queryFn: () => getProductPerformance({ from_date: fromDate, to_date: toDate }),
  });

  const { data: topCustomers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["top-customers"],
    queryFn: () => getTopCustomers(10),
  });

  const { data: bestSuppliers, isLoading: loadingSuppliers } = useQuery({
    queryKey: ["best-suppliers"],
    queryFn: () => getBestSuppliers(),
  });

  if (loadingSummary) return <PageLoader />;

  const kpis = [
    { label: "Today's Sales", value: formatCurrency(summary?.today_sales ?? 0) },
    { label: "Bills Issued Today", value: summary?.bills_issued_today ?? 0 },
    { label: "Debtors Outstanding", value: formatCurrency(summary?.total_debtors_outstanding ?? 0) },
    { label: "Creditors Payable", value: formatCurrency(summary?.total_creditors_payable ?? 0) },
    { label: "Low Stock Items", value: summary?.low_stock_count ?? 0 },
  ];

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Sales Analytics" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Sales Analytics" }]} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {kpis.map((k) => (
          <Grid item xs={12} sm={6} md={2.4} key={k.label}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
                  {k.label}
                </Typography>
                <Typography variant="h6" fontWeight={800}>{k.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField label="From" type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Best-Selling Products</Typography>
              {loadingPerf ? <PageLoader /> : (
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Qty Sold</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                    <TableBody>
                      {(perf?.best_selling ?? []).map((row: any) => (
                        <TableRow key={row.stock_id}>
                          <TableCell>{row.description}</TableCell>
                          <TableCell align="right">{row.qty_sold}</TableCell>
                          <TableCell align="right">{formatCurrency(row.revenue)}</TableCell>
                        </TableRow>
                      ))}
                      {(!perf?.best_selling || perf.best_selling.length === 0) && (
                        <TableRow><TableCell colSpan={3} align="center">No sales in this period</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Slow-Selling Products</Typography>
              {loadingPerf ? <PageLoader /> : (
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Qty Sold</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                    <TableBody>
                      {(perf?.slow_selling ?? []).map((row: any) => (
                        <TableRow key={row.stock_id}>
                          <TableCell>{row.description}</TableCell>
                          <TableCell align="right">{row.qty_sold}</TableCell>
                          <TableCell align="right">{formatCurrency(row.revenue)}</TableCell>
                        </TableRow>
                      ))}
                      {(!perf?.slow_selling || perf.slow_selling.length === 0) && (
                        <TableRow><TableCell colSpan={3} align="center">No sales in this period</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top Customers</Typography>
              {loadingCustomers ? <PageLoader /> : (
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Customer</TableCell><TableCell align="right">Invoices</TableCell><TableCell align="right">Total Spend</TableCell></TableRow></TableHead>
                    <TableBody>
                      {(topCustomers ?? []).map((row: any) => (
                        <TableRow key={row.debtor_no}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell align="right">{row.invoice_count}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total_spend)}</TableCell>
                        </TableRow>
                      ))}
                      {(!topCustomers || topCustomers.length === 0) && (
                        <TableRow><TableCell colSpan={3} align="center">No data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Best Suppliers</Typography>
              {loadingSuppliers ? <PageLoader /> : (
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Supplier</TableCell><TableCell align="right">Invoices</TableCell><TableCell align="right">Total Value</TableCell></TableRow></TableHead>
                    <TableBody>
                      {(bestSuppliers ?? []).map((row: any) => (
                        <TableRow key={row.supplier_id}>
                          <TableCell>{row.supp_name}</TableCell>
                          <TableCell align="right">{row.invoice_count}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total_purchase_value)}</TableCell>
                        </TableRow>
                      ))}
                      {(!bestSuppliers || bestSuppliers.length === 0) && (
                        <TableRow><TableCell colSpan={3} align="center">No data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </FormPageLayout>
  );
}
