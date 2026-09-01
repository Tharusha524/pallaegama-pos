import { useQuery } from "@tanstack/react-query";
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Chip, Typography,
} from "@mui/material";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getCustomerSegments } from "../../../api/Pos/posOpsApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

const segmentColor: Record<string, "success" | "info" | "warning" | "error" | "default"> = {
  Champion: "success",
  "Loyal Customer": "info",
  "Potential Loyalist": "info",
  "At Risk": "warning",
  Dormant: "error",
  "One-Time Buyer": "default",
};

export default function CustomerSegmentsPage() {
  const { formatCurrency } = useHomeCurrency();
  const { data, isLoading } = useQuery({ queryKey: ["customer-segments"], queryFn: () => getCustomerSegments() });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Customer Segments (RFM)" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Customer Segments" }]} />
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Customer</TableCell><TableCell align="right">Days Since Last Purchase</TableCell>
                <TableCell align="right">Invoices</TableCell><TableCell align="right">Total Spend</TableCell><TableCell align="center">Segment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((c: any) => (
                <TableRow key={c.debtor_no} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell align="right">{c.recency_days}</TableCell>
                  <TableCell align="right">{c.frequency}</TableCell>
                  <TableCell align="right">{formatCurrency(c.monetary)}</TableCell>
                  <TableCell align="center"><Chip label={c.segment} size="small" color={segmentColor[c.segment] ?? "default"} /></TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && (
                <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No customer purchase history yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </FormPageLayout>
  );
}
