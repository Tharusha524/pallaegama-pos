import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete,
  FormControl, InputLabel, Select, MenuItem, Chip, IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getStockTransfers, createStockTransfer, dispatchStockTransfer, receiveStockTransfer } from "../../../api/Pos/posOpsApi";
import { getItems } from "../../../api/Item/ItemApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";

const statusColor: Record<string, "default" | "warning" | "info" | "success" | "error"> = {
  pending: "warning", dispatched: "info", received: "success", cancelled: "error",
};

export default function StockTransfersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [items2, setItems2] = useState<{ stock_id: any; quantity: string }[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [qty, setQty] = useState("1");

  const { data: transfers, isLoading } = useQuery({ queryKey: ["stock-transfers"], queryFn: getStockTransfers });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  const createMutation = useMutation({
    mutationFn: createStockTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      setOpen(false);
      setFromLoc(""); setToLoc(""); setItems2([]);
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: dispatchStockTransfer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
  });

  const receiveMutation = useMutation({
    mutationFn: receiveStockTransfer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
  });

  const addLine = () => {
    if (!selectedItem) return;
    setItems2((prev) => [...prev, { stock_id: selectedItem, quantity: qty }]);
    setSelectedItem(null);
    setQty("1");
  };

  const handleSubmit = () => {
    if (!fromLoc || !toLoc || items2.length === 0) return;
    createMutation.mutate({
      from_loc_code: fromLoc,
      to_loc_code: toLoc,
      items: items2.map((i) => ({ stock_id: i.stock_id.stock_id, quantity: Number(i.quantity) || 0 })),
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Stock Transfers" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Stock Transfers" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New Transfer</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Ref</TableCell><TableCell>From</TableCell><TableCell>To</TableCell>
                <TableCell>Items</TableCell><TableCell align="center">Status</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(transfers ?? []).map((t: any) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.transfer_ref}</TableCell>
                  <TableCell>{t.from_loc_code}</TableCell>
                  <TableCell>{t.to_loc_code}</TableCell>
                  <TableCell>{(t.items ?? []).map((i: any) => `${i.stock?.description ?? i.stock_id} x${i.quantity}`).join(", ")}</TableCell>
                  <TableCell align="center"><Chip label={t.status} size="small" color={statusColor[t.status]} /></TableCell>
                  <TableCell align="center">
                    {t.status === "pending" && (
                      <Button size="small" startIcon={<LocalShippingIcon />} onClick={() => dispatchMutation.mutate(t.id)}>Dispatch</Button>
                    )}
                    {t.status === "dispatched" && (
                      <Button size="small" startIcon={<CheckCircleIcon />} onClick={() => receiveMutation.mutate(t.id)}>Receive</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!transfers || transfers.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No transfers yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Stock Transfer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>From Location</InputLabel>
                <Select value={fromLoc} label="From Location" onChange={(e) => setFromLoc(e.target.value)}>
                  {(locations ?? []).map((loc: any) => <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>To Location</InputLabel>
                <Select value={toLoc} label="To Location" onChange={(e) => setToLoc(e.target.value)}>
                  {(locations ?? []).map((loc: any) => <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <Autocomplete
                sx={{ flex: 1 }}
                options={items ?? []}
                getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
                value={selectedItem}
                onChange={(_, val) => setSelectedItem(val)}
                renderInput={(params) => <TextField {...params} label="Product" />}
              />
              <TextField label="Qty" type="number" sx={{ width: 100 }} value={qty} onChange={(e) => setQty(e.target.value)} />
              <Button variant="outlined" onClick={addLine} disabled={!selectedItem}>Add</Button>
            </Stack>
            {items2.map((i, idx) => (
              <Stack direction="row" key={idx} justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{i.stock_id.description} x {i.quantity}</Typography>
                <IconButton size="small" onClick={() => setItems2((prev) => prev.filter((_, x) => x !== idx))}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!fromLoc || !toLoc || items2.length === 0 || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Creating..." : "Create Transfer"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
