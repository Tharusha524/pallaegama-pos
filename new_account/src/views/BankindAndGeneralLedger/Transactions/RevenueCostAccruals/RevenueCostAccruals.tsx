import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import CostCenterSelect from "../../../../components/CostCenterSelect";
import theme from "../../../../theme";
import { useCompanySetupSettings } from "../../../../hooks/useCompanySetupSettings";
import {
  previewAccruals,
  processAccruals,
  type AccrualPreviewRow,
} from "../../../../api/Banking/BankingTransactionApi";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { notify } from "../../../../services/notificationService";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

const FREQ_OPTIONS = [
  { value: "1", label: "Weekly" },
  { value: "2", label: "Bi-weekly" },
  { value: "3", label: "Monthly" },
  { value: "4", label: "Quarterly" },
];

export default function RevenueCostAccruals() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Revenue / Cost Accruals');
  const navigate = useNavigate();
  const { costCenterLevel, useCostCenters } = useCompanySetupSettings();

  const { data: chartMasters = [] } = useQuery({
    queryKey: ["chartMasters"],
    queryFn: () =>
      import("../../../../api/GLAccounts/ChartMasterApi").then((m) => m.getChartMasters()),
  });

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    acc_act: "",
    res_act: "",
    amount: "",
    freq: "3",
    periods: "1",
    cost_center_id: "",
    cost_center2_id: "",
    memo: "",
  });

  const [previewRows, setPreviewRows] = useState<AccrualPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const accountOptions = useMemo(
    () =>
      (chartMasters as { account_code?: string; account_name?: string }[]).map((a) => ({
        code: a.account_code ?? "",
        label: `${a.account_code} — ${a.account_name ?? ""}`,
      })),
    [chartMasters]
  );

  const payload = () => ({
    date: form.date,
    acc_act: form.acc_act,
    res_act: form.res_act,
    amount: Number(form.amount),
    freq: Number(form.freq),
    periods: Number(form.periods),
    cost_center_id: form.cost_center_id ? Number(form.cost_center_id) : 0,
    cost_center2_id: form.cost_center2_id ? Number(form.cost_center2_id) : 0,
    memo: form.memo || undefined,
  });

  const handleShow = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await previewAccruals(payload());
      setPreviewRows(data.rows ?? []);
    } catch (e) {
      setError(getFriendlyApiErrorMessage(e));
      setPreviewRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!window.confirm("Are you sure you want to post accruals?")) return;
    setLoading(true);
    setError("");
    try {
      const result = await processAccruals(payload());
      notify.success(result.message ?? "Accruals processed.");
      setPreviewRows([]);
      setForm((f) => ({ ...f, amount: "", periods: "1", memo: "" }));
    } catch (e) {
      setError(getFriendlyApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPageLayout>
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Box>
          <PageTitle title="Revenue / Cost Accruals" />
          <Breadcrumb
            breadcrumbs={[
              { title: "Home", href: "/dashboard" },
              { title: "Banking & GL", href: "/bankingandgeneralledger/transactions" },
              { title: "Revenue / Cost Accruals" },
            ]}
          />
        </Box>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Spread revenue or cost across multiple periods. Each period posts a balanced journal entry
          (FrontAccounting accruals).
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="First date of accruals"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="Accrued balance account"
              value={form.acc_act}
              onChange={(e) => setForm({ ...form, acc_act: e.target.value })}
            >
              <MenuItem value="">Select account</MenuItem>
              {accountOptions.map((a) => (
                <MenuItem key={a.code} value={a.code}>
                  {a.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="Revenue / Cost account"
              value={form.res_act}
              onChange={(e) => setForm({ ...form, res_act: e.target.value })}
            >
              <MenuItem value="">Select account</MenuItem>
              {accountOptions.map((a) => (
                <MenuItem key={a.code} value={a.code}>
                  {a.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {useCostCenters && (
            <Grid item xs={12} sm={4}>
              <CostCenterSelect
                value={form.cost_center_id}
                onChange={(v) => setForm({ ...form, cost_center_id: v })}
                costCenterType={1}
                allowEmpty
                emptyLabel="No costCenter"
                label="CostCenter 1"
              />
            </Grid>
          )}
          {useCostCenters && costCenterLevel >= 2 && (
            <Grid item xs={12} sm={4}>
              <CostCenterSelect
                value={form.cost_center2_id}
                onChange={(v) => setForm({ ...form, cost_center2_id: v })}
                costCenterType={2}
                allowEmpty
                emptyLabel="No costCenter 2"
                label="CostCenter 2"
              />
            </Grid>
          )}

          <Grid item xs={12} sm={4}>
            <FormattedNumberField
              fullWidth
              size="small"
              label="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="Frequency"
              value={form.freq}
              onChange={(e) => setForm({ ...form, freq: e.target.value })}
            >
              {FREQ_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormattedNumberField
              fullWidth
              size="small"
              label="Periods"
              inputProps={{ min: 1 }}
              value={form.periods}
              onChange={(e) => setForm({ ...form, periods: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Memo"
              multiline
              minRows={2}
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={handleShow} disabled={loading}>
            Show GL Rows
          </Button>
          <Button variant="contained" onClick={handleProcess} disabled={loading || !canEdit}>
            Process Accruals
          </Button>
        </Stack>
      </Paper>
      {previewRows.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Account</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {previewRows.flatMap((row, idx) => [
                <TableRow key={`${idx}-acc`}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.acc_act}</TableCell>
                  <TableCell align="right" />
                  <TableCell align="right">{Number(row.amount).toFixed(2)}</TableCell>
                </TableRow>,
                <TableRow key={`${idx}-res`}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.res_act}</TableCell>
                  <TableCell align="right">{Number(row.amount).toFixed(2)}</TableCell>
                  <TableCell align="right" />
                </TableRow>,
              ])}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </FormPageLayout>
  );
}
