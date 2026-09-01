import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete,
  FormControl, InputLabel, Select, MenuItem, Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getInventoryAudits, createInventoryAudit, addInventoryAuditItem, completeInventoryAudit } from "../../../api/Pos/posOpsApi";
import { getItems } from "../../../api/Item/ItemApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";

export default function InventoryAuditsPage() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [locCode, setLocCode] = useState("");
  const [notes, setNotes] = useState("");
  const [countOpen, setCountOpen] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [countedQty, setCountedQty] = useState("0");

  const { data: audits, isLoading } = useQuery({ queryKey: ["inventory-audits"], queryFn: getInventoryAudits });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  const createMutation = useMutation({
    mutationFn: createInventoryAudit,
    onSuccess: (audit) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-audits"] });
      setNewOpen(false);
      setLocCode(""); setNotes("");
      setCountOpen(audit.id);
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ auditId, data }: { auditId: number; data: any }) => addInventoryAuditItem(auditId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-audits"] });
      setSelectedItem(null);
      setCountedQty("0");
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeInventoryAudit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-audits"] });
      setCountOpen(null);
    },
  });

  const currentAudit = (audits ?? []).find((a: any) => a.id === countOpen);

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Inventory Audits" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Inventory Audits" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>Start Count</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Ref</TableCell><TableCell>Location</TableCell><TableCell align="right">Items Counted</TableCell>
                <TableCell align="center">Status</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(audits ?? []).map((a: any) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.audit_ref}</TableCell>
                  <TableCell>{a.loc_code}</TableCell>
                  <TableCell align="right">{(a.items ?? []).length}</TableCell>
                  <TableCell align="center"><Chip label={a.status} size="small" color={a.status === "open" ? "warning" : "success"} /></TableCell>
                  <TableCell align="center">
                    {a.status === "open" && (
                      <Button size="small" onClick={() => setCountOpen(a.id)}>Continue Count</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!audits || audits.length === 0) && (
                <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2">No audits yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Start Physical Count</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select value={locCode} label="Location" onChange={(e) => setLocCode(e.target.value)}>
                {(locations ?? []).map((loc: any) => <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Notes" fullWidth value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!locCode || createMutation.isPending} onClick={() => createMutation.mutate({ loc_code: locCode, notes })}>
            Start
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={countOpen !== null} onClose={() => setCountOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Count Items — {currentAudit?.audit_ref}</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={2} sx={{ mt: 1, mb: 2 }}>
            <Autocomplete
              sx={{ flex: 1 }}
              options={items ?? []}
              getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              value={selectedItem}
              onChange={(_, val) => setSelectedItem(val)}
              renderInput={(params) => <TextField {...params} label="Product" />}
            />
            <TextField label="Counted Qty" type="number" sx={{ width: 120 }} value={countedQty} onChange={(e) => setCountedQty(e.target.value)} />
            <Button
              variant="outlined"
              disabled={!selectedItem}
              onClick={() => countOpen && addItemMutation.mutate({ auditId: countOpen, data: { stock_id: selectedItem.stock_id, counted_quantity: Number(countedQty) || 0 } })}
            >
              Add
            </Button>
          </Stack>
          <Table size="small">
            <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">System</TableCell><TableCell align="right">Counted</TableCell><TableCell align="right">Variance</TableCell></TableRow></TableHead>
            <TableBody>
              {(currentAudit?.items ?? []).map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.stock?.description ?? i.stock_id}</TableCell>
                  <TableCell align="right">{i.system_quantity}</TableCell>
                  <TableCell align="right">{i.counted_quantity}</TableCell>
                  <TableCell align="right" style={{ color: Number(i.variance) !== 0 ? "red" : undefined }}>{i.variance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCountOpen(null)}>Close</Button>
          <Button
            variant="contained" startIcon={<DoneAllIcon />}
            disabled={!currentAudit?.items?.length || completeMutation.isPending}
            onClick={() => countOpen && completeMutation.mutate(countOpen)}
          >
            Complete Audit & Adjust Stock
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
