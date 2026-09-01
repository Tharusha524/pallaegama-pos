import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Chip, Typography,
  FormControl, InputLabel, Select, MenuItem, Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getLoyaltyCards, createLoyaltyCard, updateLoyaltyCard } from "../../../api/Loyalty/loyaltyApi";
import { getLoyaltyTiers } from "../../../api/Loyalty/loyaltyApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";

export default function LoyaltyCardsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [debtorNo, setDebtorNo] = useState<any>(null);
  const [tierId, setTierId] = useState("");

  const { data: cards, isLoading } = useQuery({ queryKey: ["loyalty-cards"], queryFn: getLoyaltyCards });
  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });
  const { data: tiers } = useQuery({ queryKey: ["loyalty-tiers"], queryFn: getLoyaltyTiers });

  const createMutation = useMutation({
    mutationFn: createLoyaltyCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-cards"] });
      setOpen(false);
      setDebtorNo(null);
      setTierId("");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateLoyaltyCard(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loyalty-cards"] }),
  });

  const handleSubmit = () => {
    if (!debtorNo) return;
    createMutation.mutate({ debtor_no: debtorNo.debtor_no, loyalty_tier_id: tierId || null });
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Loyalty Cards" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Loyalty Cards" }]} />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Issue Card</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Card No</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell align="right">Points Balance</TableCell>
                <TableCell>Issue Date</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(cards ?? []).map((card: any) => (
                <TableRow key={card.id} hover>
                  <TableCell>{card.card_no}</TableCell>
                  <TableCell>{card.debtor?.name}</TableCell>
                  <TableCell>{card.tier?.tier_name ?? "—"}</TableCell>
                  <TableCell align="right">{card.points_balance}</TableCell>
                  <TableCell>{String(card.issue_date).slice(0, 10)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={card.status}
                      size="small"
                      color={card.status === "active" ? "success" : "default"}
                      onClick={() => toggleStatusMutation.mutate({ id: card.id, status: card.status === "active" ? "blocked" : "active" })}
                      sx={{ cursor: "pointer" }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {(!cards || cards.length === 0) && (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">No loyalty cards issued yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Issue Loyalty Card</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={customers ?? []}
              getOptionLabel={(c: any) => c.name ?? ""}
              value={debtorNo}
              onChange={(_, val) => setDebtorNo(val)}
              renderInput={(params) => <TextField {...params} label="Customer" />}
            />
            <FormControl fullWidth>
              <InputLabel>Loyalty Tier</InputLabel>
              <Select value={tierId} label="Loyalty Tier" onChange={(e) => setTierId(e.target.value)}>
                {(tiers ?? []).map((t: any) => (
                  <MenuItem key={t.id} value={t.id}>{t.tier_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!debtorNo || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Issuing..." : "Issue Card"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
