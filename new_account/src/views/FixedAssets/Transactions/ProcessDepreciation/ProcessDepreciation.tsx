import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import {
  FaDepreciationPreviewLine,
  previewFaDepreciation,
  processFaDepreciation,
} from "../../../../api/FaDepreciation/FaDepreciationApi";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import { formatFaItemLabel } from "../../../../utils/fixedAssetsScreenCopy";
import { useAuth } from "../../../../context/AuthContext";

const methodLabels: Record<string, string> = {
  D: "Declining balance",
  S: "Straight line",
  N: "Sum of years digits",
  O: "One-time",
};

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProcessDepreciation() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Depreciation');
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [periodDate, setPeriodDate] = useState(today);
  const [dateError, setDateError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState("");

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ["fiscalYears"],
    queryFn: getFiscalYears,
  });

  const currentFiscalYear = useMemo(() => {
    const now = new Date();
    return fiscalYears.find(
      (fy: { isClosed?: boolean; fiscal_year_from: string; fiscal_year_to: string }) =>
        !fy.isClosed &&
        new Date(fy.fiscal_year_from) <= now &&
        now <= new Date(fy.fiscal_year_to)
    );
  }, [fiscalYears]);

  useEffect(() => {
    if (!periodDate) return;
    if (!currentFiscalYear) {
      setDateError("");
      return;
    }
    const selected = new Date(periodDate);
    const start = new Date(currentFiscalYear.fiscal_year_from);
    const end = new Date(currentFiscalYear.fiscal_year_to);
    if (selected < start || selected > end) {
      setDateError("Date must be within the active fiscal year.");
    } else {
      setDateError("");
    }
  }, [periodDate, currentFiscalYear]);

  const dateValid = !!periodDate && !dateError;

  const {
    data: preview,
    isFetching,
    refetch,
    error: previewError,
  } = useQuery({
    queryKey: ["faDepreciationPreview", periodDate],
    queryFn: () => previewFaDepreciation(periodDate),
    enabled: dateValid,
  });

  useEffect(() => {
    if (!preview?.lines) return;
    const ids = preview.lines
      .filter((l) => l.selected && !l.already_posted && l.depreciation_amount > 0)
      .map((l) => l.stock_id);
    setSelectedIds(new Set(ids));
  }, [preview]);

  const processMutation = useMutation({
    mutationFn: () =>
      processFaDepreciation({
        period_date: periodDate,
        stock_ids: Array.from(selectedIds),
      }),
    onSuccess: (result) => {
      if (!result.batch) {
        setSubmitError(result.message || "No assets were depreciated.");
        return;
      }
      navigate("/fixedassets/transactions/process-depreciation/success", {
        state: {
          reference: result.reference,
          date: periodDate,
          total_amount: result.total_amount,
          assets_count: result.batch.assets_count,
        },
      });
    },
    onError: (err: unknown) => {
      setSubmitError(getFriendlyApiErrorMessage(err) || "Failed to process depreciation.");
    },
  });

  const toggleRow = (stockId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stockId)) next.delete(stockId);
      else next.add(stockId);
      return next;
    });
  };

  const selectableLines = preview?.lines?.filter((l) => !l.already_posted && l.depreciation_amount > 0) ?? [];
  const selectedTotal = selectableLines
    .filter((l) => selectedIds.has(l.stock_id))
    .reduce((sum, l) => sum + l.depreciation_amount, 0);

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Fixed Assets", href: "/fixedassets/transactions" },
    { title: "Process Depreciation" },
  ];

  return (
    <FormPageLayout>
      <Box
        sx={{
          p: 2,
          boxShadow: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <PageTitle title="Process Depreciation" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/fixedassets/transactions")}
        >
          Back
        </Button>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
          <TextField
            label="Period end date"
            type="date"
            value={periodDate}
            onChange={(e) => setPeriodDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            error={!!dateError}
            helperText={dateError || "Depreciation is calculated for assets active on this date."}
          />
          <Button
            variant="outlined"
            startIcon={isFetching ? <CircularProgress size={18} /> : <RefreshIcon />}
            onClick={() => refetch()}
            disabled={isFetching || !!dateError}
          >
            Refresh preview
          </Button>
        </Stack>

        {preview && (
          <Typography sx={{ mt: 2 }} color="text.secondary">
            Period key: {preview.period_key} · {preview.periods_per_year === 12 ? "Monthly" : "Yearly"} depreciation ·{" "}
            {preview.asset_count} asset(s) in preview
          </Typography>
        )}

        {(previewError || submitError) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError ||
              getFriendlyApiErrorMessage(previewError) || "Could not load depreciation preview."}
          </Alert>
        )}

        <TableContainer sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Asset</TableCell>
                <TableCell>Method</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell align="right">Accum. dep.</TableCell>
                <TableCell align="right">Book value</TableCell>
                <TableCell align="right">This period</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isFetching && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress size={28} sx={{ my: 2 }} />
                  </TableCell>
                </TableRow>
              )}
              {!isFetching &&
                (preview?.lines ?? []).map((line: FaDepreciationPreviewLine) => {
                  const canSelect = !line.already_posted && line.depreciation_amount > 0;
                  return (
                    <TableRow
                      key={line.stock_id}
                      sx={{ opacity: line.already_posted ? 0.6 : 1 }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(line.stock_id)}
                          disabled={!canSelect}
                          onChange={() => toggleRow(line.stock_id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {formatFaItemLabel({
                            stock_id: line.stock_id,
                            description: line.description,
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {methodLabels[line.depreciation_method] ?? line.depreciation_method} (
                        {line.depreciation_rate}%)
                      </TableCell>
                      <TableCell align="right">{formatMoney(line.asset_cost)}</TableCell>
                      <TableCell align="right">{formatMoney(line.accumulated_depreciation)}</TableCell>
                      <TableCell align="right">{formatMoney(line.book_value)}</TableCell>
                      <TableCell align="right">{formatMoney(line.depreciation_amount)}</TableCell>
                      <TableCell>
                        {line.already_posted
                          ? "Already posted"
                          : line.depreciation_amount <= 0
                            ? "No amount"
                            : "Ready"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!isFetching && (preview?.lines?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No fixed assets to depreciate for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
          <Typography fontWeight={600}>
            Selected total: {formatMoney(selectedTotal)} ({selectedIds.size} asset(s))
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={
              processMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />
            }
            disabled={
              processMutation.isPending ||
              selectedIds.size === 0 ||
              !!dateError ||
              isFetching ||
              !canEdit
            }
            onClick={() => {
              setSubmitError("");
              processMutation.mutate();
            }}
          >
            Process depreciation
          </Button>
        </Stack>
      </Paper>
    </FormPageLayout>
  );
}
