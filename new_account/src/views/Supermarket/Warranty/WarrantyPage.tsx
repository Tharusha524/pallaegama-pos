import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import {
  getWarrantyPolicies, createWarrantyPolicy, getWarranties, createWarranty, checkWarranty,
  getWarrantyClaims, updateWarrantyClaim,
} from "../../../api/Pos/posOpsApi";
import { getItems } from "../../../api/Item/ItemApi";

export default function WarrantyPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"check" | "warranties" | "policies" | "claims">("check");

  // Check tab
  const [checkQuery, setCheckQuery] = useState("");
  const [checkResults, setCheckResults] = useState<any[] | null>(null);
  const [checking, setChecking] = useState(false);

  // Policies tab
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({ policy_name: "", period_value: "12", period_unit: "months", terms: "" });

  // Warranties tab
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [warrantyForm, setWarrantyForm] = useState({ stock_id: null as any, warranty_policy_id: "", serial_no: "", warranty_start: new Date().toISOString().slice(0, 10) });

  const { data: policies } = useQuery({ queryKey: ["warranty-policies"], queryFn: getWarrantyPolicies });
  const { data: warranties, isLoading: loadingWarranties } = useQuery({ queryKey: ["warranties"], queryFn: () => getWarranties() });
  const { data: claims, isLoading: loadingClaims } = useQuery({ queryKey: ["warranty-claims"], queryFn: getWarrantyClaims });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });

  const createPolicyMutation = useMutation({
    mutationFn: createWarrantyPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warranty-policies"] });
      setPolicyOpen(false);
      setPolicyForm({ policy_name: "", period_value: "12", period_unit: "months", terms: "" });
    },
  });

  const createWarrantyMutation = useMutation({
    mutationFn: createWarranty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warranties"] });
      setWarrantyOpen(false);
      setWarrantyForm({ stock_id: null, warranty_policy_id: "", serial_no: "", warranty_start: new Date().toISOString().slice(0, 10) });
    },
  });

  const handleCheck = async () => {
    if (!checkQuery.trim()) return;
    setChecking(true);
    try {
      const results = await checkWarranty(checkQuery.trim());
      setCheckResults(results);
    } finally {
      setChecking(false);
    }
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Warranty Management" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Warranty" }]} />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Check Warranty" value="check" />
        <Tab label="Warranties" value="warranties" />
        <Tab label="Policies" value="policies" />
        <Tab label="Claims" value="claims" />
      </Tabs>

      {tab === "check" && (
        <Box>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Search by serial number, invoice reference, or phone" size="small" fullWidth
              value={checkQuery} onChange={(e) => setCheckQuery(e.target.value)}
            />
            <Button variant="contained" startIcon={<SearchIcon />} onClick={handleCheck} disabled={checking}>Verify</Button>
          </Stack>
          {checkResults && (
            <TableContainer component={Paper} elevation={2}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Product</TableCell><TableCell>Serial</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {checkResults.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.stock?.description}</TableCell>
                      <TableCell>{w.serial_no ?? "—"}</TableCell>
                      <TableCell>{w.warranty_start}</TableCell>
                      <TableCell>{w.warranty_end}</TableCell>
                      <TableCell><Chip label={w.status} size="small" color={w.status === "active" ? "success" : "default"} /></TableCell>
                    </TableRow>
                  ))}
                  {checkResults.length === 0 && <TableRow><TableCell colSpan={5} align="center">No warranty record found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {tab === "warranties" && (
        <Box>
          <Box sx={{ mb: 2 }}><Button variant="contained" startIcon={<AddIcon />} onClick={() => setWarrantyOpen(true)}>Register Warranty</Button></Box>
          {loadingWarranties ? <PageLoader /> : (
            <TableContainer component={Paper} elevation={2}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                  <TableRow><TableCell>Product</TableCell><TableCell>Policy</TableCell><TableCell>Serial</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell><TableCell>Status</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {(warranties ?? []).map((w: any) => (
                    <TableRow key={w.id} hover>
                      <TableCell>{w.stock?.description}</TableCell>
                      <TableCell>{w.policy?.policy_name}</TableCell>
                      <TableCell>{w.serial_no ?? "—"}</TableCell>
                      <TableCell>{w.warranty_start}</TableCell>
                      <TableCell>{w.warranty_end}</TableCell>
                      <TableCell><Chip label={w.status} size="small" color={w.status === "active" ? "success" : "default"} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {tab === "policies" && (
        <Box>
          <Box sx={{ mb: 2 }}><Button variant="contained" startIcon={<AddIcon />} onClick={() => setPolicyOpen(true)}>Add Policy</Button></Box>
          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                <TableRow><TableCell>Name</TableCell><TableCell>Period</TableCell><TableCell>Terms</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {(policies ?? []).map((p: any) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.policy_name}</TableCell>
                    <TableCell>{p.period_value} {p.period_unit}</TableCell>
                    <TableCell>{p.terms ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "claims" && (
        <Box>
          {loadingClaims ? <PageLoader /> : (
            <TableContainer component={Paper} elevation={2}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                  <TableRow><TableCell>Product</TableCell><TableCell>Issue</TableCell><TableCell>Status</TableCell><TableCell>Date</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {(claims ?? []).map((c: any) => (
                    <TableRow key={c.id} hover>
                      <TableCell>{c.warranty?.stock?.description}</TableCell>
                      <TableCell>{c.issue_description}</TableCell>
                      <TableCell>
                        <Select
                          size="small" value={c.status}
                          onChange={(e) => updateWarrantyClaim(c.id, { status: e.target.value }).then(() => queryClient.invalidateQueries({ queryKey: ["warranty-claims"] }))}
                        >
                          <MenuItem value="open">Open</MenuItem>
                          <MenuItem value="in_progress">In Progress</MenuItem>
                          <MenuItem value="resolved">Resolved</MenuItem>
                          <MenuItem value="rejected">Rejected</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>{c.claim_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <Dialog open={policyOpen} onClose={() => setPolicyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Warranty Policy</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Policy Name" fullWidth value={policyForm.policy_name} onChange={(e) => setPolicyForm({ ...policyForm, policy_name: e.target.value })} />
            <Stack direction="row" spacing={2}>
              <TextField label="Period" type="number" fullWidth value={policyForm.period_value} onChange={(e) => setPolicyForm({ ...policyForm, period_value: e.target.value })} />
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select value={policyForm.period_unit} label="Unit" onChange={(e) => setPolicyForm({ ...policyForm, period_unit: e.target.value })}>
                  <MenuItem value="days">Days</MenuItem>
                  <MenuItem value="months">Months</MenuItem>
                  <MenuItem value="years">Years</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TextField label="Terms" fullWidth multiline rows={2} value={policyForm.terms} onChange={(e) => setPolicyForm({ ...policyForm, terms: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!policyForm.policy_name} onClick={() => createPolicyMutation.mutate({ ...policyForm, period_value: Number(policyForm.period_value) })}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={warrantyOpen} onClose={() => setWarrantyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register Warranty</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={items ?? []}
              getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
              value={warrantyForm.stock_id}
              onChange={(_, val) => setWarrantyForm({ ...warrantyForm, stock_id: val })}
              renderInput={(params) => <TextField {...params} label="Product" />}
            />
            <FormControl fullWidth>
              <InputLabel>Warranty Policy</InputLabel>
              <Select value={warrantyForm.warranty_policy_id} label="Warranty Policy" onChange={(e) => setWarrantyForm({ ...warrantyForm, warranty_policy_id: e.target.value })}>
                {(policies ?? []).map((p: any) => <MenuItem key={p.id} value={p.id}>{p.policy_name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Serial Number" fullWidth value={warrantyForm.serial_no} onChange={(e) => setWarrantyForm({ ...warrantyForm, serial_no: e.target.value })} />
            <TextField label="Warranty Start" type="date" fullWidth value={warrantyForm.warranty_start} onChange={(e) => setWarrantyForm({ ...warrantyForm, warranty_start: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWarrantyOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!warrantyForm.stock_id || !warrantyForm.warranty_policy_id}
            onClick={() => createWarrantyMutation.mutate({ ...warrantyForm, stock_id: warrantyForm.stock_id.stock_id, warranty_policy_id: Number(warrantyForm.warranty_policy_id) })}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
