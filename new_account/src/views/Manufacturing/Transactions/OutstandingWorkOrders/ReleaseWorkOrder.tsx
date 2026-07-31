import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  TextField,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getComments, createComment } from "../../../../api/Comments/CommentsApi";
import theme from "../../../../theme";
import { getWorkOrderById } from "../../../../api/WorkOrders/WorkOrderApi";
import { postWorkOrderRelease } from "../../../../api/Manufacturing/ManufacturingApi";
import { runTransactionSave } from "../../../../utils/transactionSave";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import useCurrentUser from "../../../../hooks/useCurrentUser";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import { useAuth } from "../../../../context/AuthContext";

export default function ReleaseWorkOrder() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Work order releases');
  const navigate = useNavigate();
  const location = useLocation();
  const idFromState = (location.state as any)?.id ?? null;

  const queryClient = useQueryClient();
  const { data: fiscalYears = [] } = useQuery({ queryKey: ["fiscalYears"], queryFn: getFiscalYears });
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: getCompanies });
  const { user } = useCurrentUser();

  const [loadingError, setLoadingError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [woId, setWoId] = useState("");
  const [reference, setReference] = useState("");
  const [releasedDate, setReleasedDate] = useState(new Date().toISOString().split("T")[0]);
  const [memo, setMemo] = useState("");
  const [memoDisabled, setMemoDisabled] = useState(false);
  const [woRecord, setWoRecord] = useState<any | null>(null);

  const referenceFromState = (location.state as any)?.reference ?? "";

  const { data: comments = [] } = useQuery({ queryKey: ["comments", idFromState], queryFn: getComments, enabled: !!idFromState });

  useEffect(() => {
    (async () => {
      if (!idFromState) {
        setLoadingError("No work order id provided");
        return;
      }
      try {
        const wo = await getWorkOrderById(idFromState);
        if (!wo) {
          setLoadingError("Work order not found");
          return;
        }
        setWoId(String(wo.id ?? wo.wo_id ?? idFromState));
        setWoRecord(wo ?? null);
        // prefer reference passed in navigation state for snappy UX
        setReference(referenceFromState || (wo.wo_ref ?? wo.reference ?? ""));
        setReleasedDate(wo.released_date ? String(wo.released_date).split("T")[0] : new Date().toISOString().split("T")[0]);
        setMemo((prev) => {
          const existing = String(prev ?? "").trim();
          if (existing !== "") return prev as string;
          return wo.memo ?? wo.memo_ ?? wo.notes ?? "";
        });
      } catch (err) {
        console.warn("Failed to load work order:", err);
        setLoadingError("Failed to load work order");
      }
    })();
  }, [idFromState, referenceFromState]);

  // when comments load, check for an existing memo (type=26, id = workorder id)
  useEffect(() => {
    if (!idFromState) return;
    try {
      const existing = (comments || []).find((c: any) => {
        const typeVal = Number(c.type ?? c.type_id ?? c.comment_type ?? 0);
        const targetId = String(c.id ?? c.record_id ?? c.ref_id ?? c.trans_no ?? "");
        return typeVal === 26 && String(idFromState) === targetId;
      });
      if (existing) {
        const existingMemo = (existing.memo_ ?? existing.memo ?? "") as string;
        if (existingMemo && String(existingMemo).trim() !== "") {
          setMemo(existingMemo);
          if (existing.date_) setReleasedDate(String(existing.date_).split("T")[0]);
          setMemoDisabled(true);
        } else {
          // existing comment exists but has no memo; do not overwrite current memo
          setMemoDisabled(false);
        }
      } else {
        setMemoDisabled(false);
      }
    } catch (err) {
      console.warn("Failed to evaluate existing comments:", err);
    }
  }, [comments, idFromState]);

  const handleRelease = async () => {
    setSaveError("");
    if (!idFromState) return;
    setIsSaving(true);
    try {
      const saveResult = await runTransactionSave(async () =>
        postWorkOrderRelease(idFromState, {
          released_date: releasedDate,
          memo: memo?.trim() || undefined,
        })
      );

      if (saveResult.ok === false) {
        setSaveError(saveResult.message);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      navigate("/manufacturing/transactions/work-order-entry/success", {
        state: { reference, id: idFromState, type: 2, successMode: "release" },
      });
    } catch (err: unknown) {
      console.error("Failed to release work order:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to release work order");
    } finally {
      setIsSaving(false);
    }
  };

  const breadcrumbItems = [
    { title: "Transactions", href: "/manufacturing/transactions" },
    { title: "Release Work Order" },
  ];

  return (
    <FormPageLayout>
      <Box sx={{ padding: theme.spacing(2), boxShadow: 2, borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Box>
          <PageTitle title="Release Work Order" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>
      </Box>
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        {loadingError && <Alert severity="error">{loadingError}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Work Order #:" fullWidth size="small" value={woId} InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField label="Work Order Reference:" fullWidth size="small" value={reference} InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField label="Released Date:" type="date" fullWidth size="small" value={releasedDate} onChange={(e) => setReleasedDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12}>
            <TextField label="Memo" fullWidth multiline rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Enter memo or notes..." disabled={memoDisabled} />
          </Grid>

          {saveError && (
            <Grid item xs={12}>
              <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert>
            </Grid>
          )}

          <Grid item xs={12} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="contained" color="primary" onClick={handleRelease} disabled={isSaving || !canEdit}>{isSaving ? "Releasing..." : "Release Work Order"}</Button>
          </Grid>
        </Grid>
      </Paper>
    </FormPageLayout>
  );
}
