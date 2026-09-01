import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Grid, Card,
  CardContent, Typography, Autocomplete, Chip, Select, MenuItem, FormControl, InputLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BuildIcon from "@mui/icons-material/Build";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getServiceTickets, createServiceTicket, updateServiceTicket } from "../../../api/Pos/posAdvancedApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";

const emptyForm = { debtor_no: null as any, item_description: "", serial_no: "", issue_notes: "" };

const statusLabel: Record<string, string> = {
  received: "Received", in_progress: "In Progress", ready_for_pickup: "Ready for Pickup", delivered: "Delivered",
};
const statusColor: Record<string, "default" | "warning" | "info" | "success"> = {
  received: "default", in_progress: "warning", ready_for_pickup: "info", delivered: "success",
};

export default function ServiceTicketsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: tickets, isLoading } = useQuery({ queryKey: ["service-tickets"], queryFn: () => getServiceTickets() });
  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });

  const createMutation = useMutation({
    mutationFn: createServiceTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateServiceTicket(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-tickets"] }),
  });

  const groups: Record<string, any[]> = { received: [], in_progress: [], ready_for_pickup: [], delivered: [] };
  (tickets ?? []).forEach((t: any) => groups[t.status]?.push(t));

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Service Management" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Service Tickets" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New Job Ticket</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <Grid container spacing={2}>
          {Object.entries(groups).map(([status, list]) => (
            <Grid item xs={12} sm={6} md={3} key={status}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{statusLabel[status]} ({list.length})</Typography>
              <Stack spacing={1}>
                {list.map((t) => (
                  <Card key={t.id} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <CardContent sx={{ pb: "12px !important" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{t.item_description}</Typography>
                          <Typography variant="caption" color="text.secondary">{t.ticket_no}</Typography>
                          {t.debtor && <Typography variant="caption" display="block" color="text.secondary">{t.debtor.name}</Typography>}
                        </Box>
                        <BuildIcon fontSize="small" color="action" />
                      </Stack>
                      <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                        <Select
                          value={t.status}
                          onChange={(e) => updateStatusMutation.mutate({ id: t.id, status: e.target.value })}
                        >
                          <MenuItem value="received">Received</MenuItem>
                          <MenuItem value="in_progress">In Progress</MenuItem>
                          <MenuItem value="ready_for_pickup">Ready for Pickup</MenuItem>
                          <MenuItem value="delivered">Delivered</MenuItem>
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                ))}
                {list.length === 0 && <Typography variant="caption" color="text.secondary">No tickets</Typography>}
              </Stack>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Job Ticket</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={customers ?? []}
              getOptionLabel={(c: any) => c.name ?? ""}
              value={form.debtor_no}
              onChange={(_, val) => setForm({ ...form, debtor_no: val })}
              renderInput={(params) => <TextField {...params} label="Customer (optional)" />}
            />
            <TextField label="Item / Job Description" fullWidth value={form.item_description} onChange={(e) => setForm({ ...form, item_description: e.target.value })} />
            <TextField label="Serial Number" fullWidth value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} />
            <TextField label="Issue Notes" fullWidth multiline rows={2} value={form.issue_notes} onChange={(e) => setForm({ ...form, issue_notes: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained" disabled={!form.item_description || createMutation.isPending}
            onClick={() => createMutation.mutate({ ...form, debtor_no: form.debtor_no?.debtor_no })}
          >
            {createMutation.isPending ? "Creating..." : "Create Ticket"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
