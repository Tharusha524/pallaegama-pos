import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, TextField, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Typography, Stack, FormControl, InputLabel, Select, MenuItem, Chip,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getInactiveCustomers, sendWinBackOffer, getOffers } from "../../../api/Loyalty/loyaltyApi";
import { notify } from "../../../services/notificationService";

export default function WinBackPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [offerId, setOfferId] = useState("");

  const { data: inactive, isLoading } = useQuery({
    queryKey: ["inactive-customers", days],
    queryFn: () => getInactiveCustomers(days),
  });

  const { data: offers } = useQuery({ queryKey: ["offers"], queryFn: getOffers });

  const sendMutation = useMutation({
    mutationFn: sendWinBackOffer,
    onSuccess: () => {
      notify.success("Win-back offer queued");
      queryClient.invalidateQueries({ queryKey: ["inactive-customers"] });
    },
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Win-Back Campaigns" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Win-Back Campaigns" }]} />
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          label="Inactive for (days)"
          type="number"
          size="small"
          value={days}
          onChange={(e) => setDays(Number(e.target.value) || 30)}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Channel</InputLabel>
          <Select value={channel} label="Channel" onChange={(e) => setChannel(e.target.value as any)}>
            <MenuItem value="sms">SMS</MenuItem>
            <MenuItem value="whatsapp">WhatsApp</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Offer (optional)</InputLabel>
          <Select value={offerId} label="Offer (optional)" onChange={(e) => setOfferId(e.target.value)}>
            <MenuItem value="">None</MenuItem>
            {(offers ?? []).map((o: any) => (
              <MenuItem key={o.id} value={o.id}>{o.offer_name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          Note: no SMS/WhatsApp gateway is connected yet — sends are logged, not delivered.
        </Typography>
      </Stack>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Mobile</TableCell>
                <TableCell>Last Purchase</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(inactive ?? []).map((c: any) => (
                <TableRow key={c.debtor_no} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.mobile ?? "—"}</TableCell>
                  <TableCell>{c.last_purchase_date ? String(c.last_purchase_date).slice(0, 10) : "Never"}</TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CampaignIcon />}
                      disabled={sendMutation.isPending}
                      onClick={() => sendMutation.mutate({
                        debtor_no: c.debtor_no,
                        offer_id: offerId ? Number(offerId) : undefined,
                        channel,
                      })}
                    >
                      Send Offer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!inactive || inactive.length === 0) && (
                <TableRow><TableCell colSpan={4} align="center"><Typography variant="body2">No inactive customers in this window.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </FormPageLayout>
  );
}
