import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography,
} from "@mui/material";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getNormalCustomers, makeLoyaltyCustomer } from "../../../api/Loyalty/loyaltyApi";
import { notify } from "../../../services/notificationService";

// Customers who signed up in the mobile app but are not loyalty customers yet.
// "Make Loyalty" gives them a Silver card; they then move to Loyalty Customers.
export default function NormalCustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmCustomer, setConfirmCustomer] = useState<any>(null);

  const { data: customers, isLoading } = useQuery({ queryKey: ["normal-customers"], queryFn: getNormalCustomers });

  const makeLoyaltyMutation = useMutation({
    mutationFn: (debtorNo: string) => makeLoyaltyCustomer(debtorNo),
    onSuccess: () => {
      notify.success(`${confirmCustomer?.name} is now a loyalty customer (Silver)`);
      setConfirmCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["normal-customers"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-cards"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to make loyalty customer"),
  });

  const filtered = (customers ?? []).filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.mobile?.includes(s);
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Normal Customers" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Normal Customers" }]} />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Customers who registered in the mobile app. Click "Make Loyalty" to give them a loyalty card — they start at Silver.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small" fullWidth
          placeholder="Search by name or phone number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Phone Number</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Birthday</TableCell>
                <TableCell>Registered Date</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.debtor_no} hover>
                  <TableCell>{c.mobile ?? "—"}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.date_of_birth ? String(c.date_of_birth).slice(0, 10) : "—"}</TableCell>
                  <TableCell>{c.created_at ? String(c.created_at).slice(0, 10) : "—"}</TableCell>
                  <TableCell align="center">
                    <Button size="small" variant="contained" startIcon={<CardMembershipIcon />} onClick={() => setConfirmCustomer(c)}>
                      Make Loyalty
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2">No normal customers.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!confirmCustomer} onClose={() => setConfirmCustomer(null)}>
        <DialogTitle>Make Loyalty Customer</DialogTitle>
        <DialogContent>
          <Typography>
            Make <b>{confirmCustomer?.name}</b> ({confirmCustomer?.mobile}) a loyalty customer?
            They start at Silver with 0 points.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCustomer(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={makeLoyaltyMutation.isPending}
            onClick={() => makeLoyaltyMutation.mutate(String(confirmCustomer.debtor_no))}
          >
            Make Loyalty
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
