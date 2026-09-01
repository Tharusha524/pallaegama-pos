import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Typography, Card, CardContent, Stack, TextField, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getVelocityAndDemand, getDeadStock, getProductProfit, getBusinessActivity, getValuation } from "../../../api/Pos/posAdvancedApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

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

  return (
    <FormPageLayout>
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
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab label="Velocity & Demand" value="velocity" />
        <Tab label="Dead Stock" value="dead-stock" />
        <Tab label="Product Profit" value="profit" />
        <Tab label="Business Activity" value="activity" />
        <Tab label="Valuation" value="valuation" />
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
    </FormPageLayout>
  );
}
