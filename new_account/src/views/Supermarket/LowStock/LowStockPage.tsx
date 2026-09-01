import { useQuery } from "@tanstack/react-query";
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Chip, Typography,
} from "@mui/material";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getLowStock } from "../../../api/Pos/posApi";

const statusColor: Record<string, "error" | "warning" | "success"> = {
  critical: "error",
  low: "warning",
  ok: "success",
};

export default function LowStockPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["low-stock"],
    queryFn: () => getLowStock(30),
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Low Stock Alerts" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Low Stock Alerts" }]} />
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">Current Qty</TableCell>
                <TableCell align="right">Reorder Level</TableCell>
                <TableCell align="right">Avg Daily Sales</TableCell>
                <TableCell align="right">Days Remaining</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((row: any, idx: number) => (
                <TableRow key={`${row.stock_id}-${row.loc_code}-${idx}`} hover>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>{row.loc_code}</TableCell>
                  <TableCell align="right">{row.quantity}</TableCell>
                  <TableCell align="right">{row.reorder_level}</TableCell>
                  <TableCell align="right">{row.avg_daily_sales}</TableCell>
                  <TableCell align="right">{row.days_of_stock_remaining ?? "—"}</TableCell>
                  <TableCell align="center">
                    <Chip label={row.status} size="small" color={statusColor[row.status] ?? "default"} />
                  </TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2">No low-stock items. Everything looks fine.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </FormPageLayout>
  );
}
