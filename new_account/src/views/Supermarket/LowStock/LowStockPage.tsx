import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Chip, Typography,
  FormControl, InputLabel, Select, MenuItem, IconButton, TextField, Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getLowStock } from "../../../api/Pos/posApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { updateLocStock } from "../../../api/LocStock/LocStockApi";
import { notify } from "../../../services/notificationService";

const statusColor: Record<string, "error" | "warning" | "success"> = {
  critical: "error",
  low: "warning",
  ok: "success",
};

export default function LowStockPage() {
  const [locCode, setLocCode] = useState("");
  const [search, setSearch] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const queryClient = useQueryClient();

  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });
  const { data, isLoading } = useQuery({
    queryKey: ["low-stock", locCode],
    queryFn: () => getLowStock(30, locCode || undefined),
  });

  const saveMutation = useMutation({
    mutationFn: ({ loc, stock, level }: { loc: string; stock: string; level: number }) =>
      // The backend validates loc_code + stock_id in the body, not just the URL.
      updateLocStock(loc, stock, { loc_code: loc, stock_id: stock, reorder_level: level }),
    onSuccess: () => {
      notify.success("Reorder level updated");
      setEditKey(null);
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: () => notify.error("Failed to update reorder level"),
  });

  const startEdit = (row: any) => {
    setEditKey(`${row.stock_id}-${row.loc_code}`);
    setEditValue(String(row.reorder_level ?? 0));
  };

  const saveEdit = (row: any) => {
    const level = Number(editValue);
    if (isNaN(level) || level < 0) return;
    saveMutation.mutate({ loc: row.loc_code, stock: row.stock_id, level });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <PageTitle title="Low Stock Alerts" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Low Stock Alerts" }]} />
        </Box>
        {locations && locations.length > 1 && (
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
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search by product name or stock ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                <TableCell align="right">Suggested Reorder Qty (EOQ)</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).filter((row: any) =>
                !search || row.description?.toLowerCase().includes(search.toLowerCase()) || row.stock_id?.toLowerCase().includes(search.toLowerCase())
              ).map((row: any, idx: number) => {
                const key = `${row.stock_id}-${row.loc_code}`;
                const isEditing = editKey === key;
                return (
                  <TableRow key={`${key}-${idx}`} hover>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.loc_code}</TableCell>
                    <TableCell align="right">{row.quantity}</TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(row); if (e.key === "Escape") setEditKey(null); }}
                          sx={{ width: 80 }}
                          autoFocus
                          inputProps={{ min: 0 }}
                        />
                      ) : row.reorder_level}
                    </TableCell>
                    <TableCell align="right">{row.avg_daily_sales}</TableCell>
                    <TableCell align="right">{row.days_of_stock_remaining ?? "—"}</TableCell>
                    <TableCell align="right">{row.eoq_quantity ?? "—"}</TableCell>
                    <TableCell align="center">
                      <Chip label={row.status} size="small" color={statusColor[row.status] ?? "default"} />
                    </TableCell>
                    <TableCell align="center">
                      {isEditing ? (
                        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                          <Tooltip title="Save">
                            <IconButton size="small" color="success" onClick={() => saveEdit(row)} disabled={saveMutation.isPending}>
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton size="small" onClick={() => setEditKey(null)}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : row.loc_code === "N/A" ? (
                        // No stock record at any location yet, so there's nothing to attach a reorder level to.
                        <Tooltip title="Receive stock first to set a reorder level">
                          <span>
                            <IconButton size="small" disabled>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Edit reorder level">
                          <IconButton size="small" onClick={() => startEdit(row)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!data || data.length === 0) && (
                <TableRow><TableCell colSpan={9} align="center"><Typography variant="body2">No low-stock items. Everything looks fine.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </FormPageLayout>
  );
}
