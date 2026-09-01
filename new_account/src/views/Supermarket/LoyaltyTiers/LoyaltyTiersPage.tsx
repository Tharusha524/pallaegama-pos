import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, IconButton, Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getLoyaltyTiers, createLoyaltyTier, deleteLoyaltyTier } from "../../../api/Loyalty/loyaltyApi";

const emptyForm = { tier_name: "", min_spend_threshold: "0", points_earn_rate: "0.01", redemption_rate: "1", benefits_description: "" };

export default function LoyaltyTiersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ["loyalty-tiers"], queryFn: getLoyaltyTiers });

  const createMutation = useMutation({
    mutationFn: createLoyaltyTier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-tiers"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLoyaltyTier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loyalty-tiers"] }),
  });

  const handleSubmit = () => {
    createMutation.mutate({
      tier_name: form.tier_name,
      min_spend_threshold: Number(form.min_spend_threshold) || 0,
      points_earn_rate: Number(form.points_earn_rate) || 0,
      redemption_rate: Number(form.redemption_rate) || 0,
      benefits_description: form.benefits_description,
    });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Loyalty Tiers" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Loyalty Tiers" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add Tier</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Tier Name</TableCell>
                <TableCell align="right">Min Spend Threshold</TableCell>
                <TableCell align="right">Earn Rate (pts/currency)</TableCell>
                <TableCell align="right">Redemption Rate (currency/pt)</TableCell>
                <TableCell>Benefits</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((tier: any) => (
                <TableRow key={tier.id} hover>
                  <TableCell>{tier.tier_name}</TableCell>
                  <TableCell align="right">{tier.min_spend_threshold}</TableCell>
                  <TableCell align="right">{tier.points_earn_rate}</TableCell>
                  <TableCell align="right">{tier.redemption_rate}</TableCell>
                  <TableCell>{tier.benefits_description}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(tier.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No loyalty tiers configured yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Loyalty Tier</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Tier Name" fullWidth value={form.tier_name} onChange={(e) => setForm({ ...form, tier_name: e.target.value })} />
            <TextField label="Min Spend Threshold" type="number" fullWidth value={form.min_spend_threshold} onChange={(e) => setForm({ ...form, min_spend_threshold: e.target.value })} />
            <TextField label="Points Earn Rate (points per currency unit spent)" type="number" fullWidth value={form.points_earn_rate} onChange={(e) => setForm({ ...form, points_earn_rate: e.target.value })} />
            <TextField label="Redemption Rate (currency value per point)" type="number" fullWidth value={form.redemption_rate} onChange={(e) => setForm({ ...form, redemption_rate: e.target.value })} />
            <TextField label="Benefits Description" multiline rows={2} fullWidth value={form.benefits_description} onChange={(e) => setForm({ ...form, benefits_description: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.tier_name || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
