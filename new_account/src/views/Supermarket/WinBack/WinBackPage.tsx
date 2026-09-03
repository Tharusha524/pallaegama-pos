import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, TextField, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Typography, Stack, FormControl, InputLabel, Select, MenuItem, IconButton, Tooltip,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getInactiveCustomers, sendWinBackOffer, getOffers } from "../../../api/Loyalty/loyaltyApi";
import { getCustomer, updateCustomer } from "../../../api/Customer/AddCustomerApi";
import { notify } from "../../../services/notificationService";

export default function WinBackPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [offerId, setOfferId] = useState("");

  // Inline "add mobile" shortcut — fixes the #1 reason Send Offer fails
  // (customer has no phone number) without leaving this screen.
  const [editingDebtorNo, setEditingDebtorNo] = useState<number | null>(null);
  const [mobileDraft, setMobileDraft] = useState("");

  const { data: inactive, isLoading } = useQuery({
    queryKey: ["inactive-customers", days],
    queryFn: () => getInactiveCustomers(days),
  });

  const { data: offers } = useQuery({ queryKey: ["offers"], queryFn: getOffers });

  const sendMutation = useMutation({
    mutationFn: sendWinBackOffer,
    onSuccess: (result: any) => {
      if (result?.delivery?.sent) {
        notify.success("SMS sent successfully");
      } else {
        notify.error(result?.delivery?.message || "Message was not delivered — check the offer log for details");
      }
      queryClient.invalidateQueries({ queryKey: ["inactive-customers"] });
    },
  });

  const saveMobileMutation = useMutation({
    mutationFn: async ({ debtorNo, mobile }: { debtorNo: number; mobile: string }) => {
      // The update endpoint requires the full customer payload (name, currency,
      // sales type, etc.) — fetch the current record and merge in just the
      // mobile number, rather than risk sending a partial/invalid payload.
      const full = await getCustomer(debtorNo);
      return updateCustomer(debtorNo, {
        name: full.name,
        debtor_ref: full.debtor_ref,
        address: full.address,
        gst: full.gst,
        curr_code: full.currency?.currency_abbreviation ?? full.curr_code,
        sales_type: full.sales_type?.id ?? full.sales_type,
        credit_status: full.credit_status?.id ?? full.credit_status,
        payment_terms: full.payment_term?.terms_indicator ?? full.payment_terms,
        discount: full.discount,
        pymt_discount: full.pymt_discount,
        credit_limit: full.credit_limit,
        notes: full.notes,
        cost_center_id: full.cost_center_id ?? 0,
        cost_center2_id: full.cost_center2_id ?? 0,
        inactive: full.inactive,
        mobile,
      });
    },
    onSuccess: () => {
      notify.success("Mobile number saved");
      setEditingDebtorNo(null);
      queryClient.invalidateQueries({ queryKey: ["inactive-customers"] });
    },
    onError: () => notify.error("Failed to save mobile number"),
  });

  const startEditMobile = (debtorNo: number, currentMobile: string | null) => {
    setEditingDebtorNo(debtorNo);
    setMobileDraft(currentMobile ?? "");
  };

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
          Note: SMS is sent live via Notify.lk. WhatsApp is not yet connected — those sends are logged only.
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
                  <TableCell>
                    {editingDebtorNo === c.debtor_no ? (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <TextField
                          size="small"
                          autoFocus
                          value={mobileDraft}
                          placeholder="07XXXXXXXX"
                          onChange={(e) => setMobileDraft(e.target.value)}
                          sx={{ width: 140 }}
                        />
                        <IconButton
                          size="small"
                          color="success"
                          disabled={saveMobileMutation.isPending || !mobileDraft.trim()}
                          onClick={() => saveMobileMutation.mutate({ debtorNo: c.debtor_no, mobile: mobileDraft.trim() })}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setEditingDebtorNo(null)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <span>{c.mobile ?? "—"}</span>
                        <Tooltip title="Add / edit mobile number">
                          <IconButton size="small" onClick={() => startEditMobile(c.debtor_no, c.mobile)}>
                            <EditIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>{c.last_purchase_date ? String(c.last_purchase_date).slice(0, 10) : "Never"}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={c.mobile ? "" : "Add a mobile number first"}>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CampaignIcon />}
                          disabled={sendMutation.isPending || !c.mobile}
                          onClick={() => sendMutation.mutate({
                            debtor_no: c.debtor_no,
                            offer_id: offerId ? Number(offerId) : undefined,
                            channel,
                          })}
                        >
                          Send Offer
                        </Button>
                      </span>
                    </Tooltip>
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
