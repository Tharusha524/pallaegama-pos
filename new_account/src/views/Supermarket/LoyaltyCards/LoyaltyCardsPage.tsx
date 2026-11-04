import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Chip, Typography,
  IconButton, Tooltip, MenuItem,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import EditIcon from "@mui/icons-material/Edit";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import {
  getLoyaltyCards, updateLoyaltyCard, getLoyaltyTiers,
  getLoyaltyPointsHistory, redeemLoyaltyPoints,
} from "../../../api/Loyalty/loyaltyApi";
import { notify } from "../../../services/notificationService";

export default function LoyaltyCardsPage() {
  const queryClient = useQueryClient();
  const [ledgerCard, setLedgerCard] = useState<any>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [search, setSearch] = useState("");
  const [editCard, setEditCard] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", mobile: "", loyalty_tier_id: "", status: "active" });

  const { data: cards, isLoading } = useQuery({ queryKey: ["loyalty-cards"], queryFn: getLoyaltyCards });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateLoyaltyCard(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loyalty-cards"] }),
  });

  const { data: tiers } = useQuery({ queryKey: ["loyalty-tiers"], queryFn: getLoyaltyTiers });

  const openEdit = (card: any) => {
    setEditCard(card);
    setEditForm({
      name: card.debtor?.name ?? "",
      mobile: card.debtor?.mobile ?? "",
      loyalty_tier_id: card.loyalty_tier_id ? String(card.loyalty_tier_id) : "",
      status: card.status ?? "active",
    });
  };

  // Points are not editable here — they only move through the earn/redeem ledger.
  const editMutation = useMutation({
    mutationFn: () => updateLoyaltyCard(editCard.id, {
      name: editForm.name.trim(),
      mobile: editForm.mobile.trim() || null,
      loyalty_tier_id: editForm.loyalty_tier_id ? Number(editForm.loyalty_tier_id) : null,
      status: editForm.status,
    }),
    onSuccess: () => {
      notify.success("Customer updated");
      setEditCard(null);
      queryClient.invalidateQueries({ queryKey: ["loyalty-cards"] });
    },
    onError: (err: any) => {
      const errors = err?.response?.data?.errors;
      notify.error(errors ? String(Object.values(errors).flat()[0]) : err?.response?.data?.message || "Failed to update customer");
    },
  });

  const { data: ledgerHistory, isLoading: ledgerLoading } = useQuery({
    queryKey: ["loyalty-points-history", ledgerCard?.debtor_no],
    queryFn: () => getLoyaltyPointsHistory(ledgerCard.debtor_no),
    enabled: !!ledgerCard,
  });

  const adjustMutation = useMutation({
    mutationFn: () => redeemLoyaltyPoints({ debtor_no: ledgerCard.debtor_no, points: Number(adjustPoints) }),
    onSuccess: () => {
      notify.success("Points adjusted");
      setAdjustPoints("");
      queryClient.invalidateQueries({ queryKey: ["loyalty-points-history", ledgerCard?.debtor_no] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-cards"] });
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to adjust points"),
  });

  const filtered = (cards ?? []).filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.debtor?.name?.toLowerCase().includes(s) ||
      c.debtor?.mobile?.includes(s)
    );
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <PageTitle title="Loyalty Customers" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Loyalty Customers" }]} />
        </Box>
      </Box>

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
                <TableCell>Tier</TableCell>
                <TableCell align="right">Points Balance</TableCell>
                <TableCell>Registered Date</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Ledger</TableCell>
                <TableCell align="center">Edit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((card: any) => (
                <TableRow key={card.id} hover>
                  <TableCell>{card.debtor?.mobile ?? "—"}</TableCell>
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
                  <TableCell align="center">
                    <Tooltip title="View points ledger">
                      <IconButton size="small" onClick={() => setLedgerCard(card)}>
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit customer">
                      <IconButton size="small" color="primary" onClick={() => openEdit(card)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2">No loyalty customers found.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit customer dialog */}
      <Dialog open={!!editCard} onClose={() => setEditCard(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Loyalty Customer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Customer Name" fullWidth value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            <TextField label="Phone Number" fullWidth value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
            <TextField select label="Tier" fullWidth value={editForm.loyalty_tier_id} onChange={(e) => setEditForm({ ...editForm, loyalty_tier_id: e.target.value })}>
              {(tiers ?? []).map((t: any) => (
                <MenuItem key={t.id} value={String(t.id)}>{t.tier_name}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Status" fullWidth value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="blocked">blocked</MenuItem>
            </TextField>
            <Typography variant="caption" color="text.secondary">
              Points can't be edited here — use the Ledger to deduct points.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditCard(null)}>Cancel</Button>
          <Button variant="contained" disabled={!editForm.name.trim() || editMutation.isPending} onClick={() => editMutation.mutate()}>
            {editMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Points ledger dialog */}
      <Dialog open={!!ledgerCard} onClose={() => setLedgerCard(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Points Ledger — {ledgerCard?.debtor?.name} ({ledgerCard?.debtor?.mobile})</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Current balance: <b>{ledgerCard?.points_balance}</b> points
            </Typography>

            {ledgerLoading ? <PageLoader /> : (
              <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell><TableCell align="right">Earned</TableCell>
                      <TableCell align="right">Redeemed</TableCell><TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ledgerHistory ?? []).map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.transaction_date}</TableCell>
                        <TableCell align="right" sx={{ color: t.points_earned > 0 ? "success.main" : undefined }}>
                          {t.points_earned > 0 ? `+${t.points_earned}` : "—"}
                        </TableCell>
                        <TableCell align="right" sx={{ color: t.points_redeemed > 0 ? "error.main" : undefined }}>
                          {t.points_redeemed > 0 ? `-${t.points_redeemed}` : "—"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t.balance_after}</TableCell>
                      </TableRow>
                    ))}
                    {(!ledgerHistory || ledgerHistory.length === 0) && (
                      <TableRow><TableCell colSpan={4} align="center"><Typography variant="body2">No points activity yet.</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Manually deduct points" type="number" size="small"
                value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)}
                helperText="e.g. to correct a mistaken earn"
              />
              <Button
                variant="outlined" size="small"
                disabled={!adjustPoints || Number(adjustPoints) <= 0 || adjustMutation.isPending}
                onClick={() => adjustMutation.mutate()}
              >
                {adjustMutation.isPending ? "Applying..." : "Apply"}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLedgerCard(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
