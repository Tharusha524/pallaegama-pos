import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  ListSubheader,
  Typography,
  Grid,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useQuery } from "@tanstack/react-query";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import theme from "../../../../theme";
import { getWorkOrderById } from "../../../../api/WorkOrders/WorkOrderApi";
import { getWorkCentres } from "../../../../api/WorkCentre/WorkCentreApi";
import { postWorkOrderCost } from "../../../../api/Manufacturing/ManufacturingApi";
import { runTransactionSave } from "../../../../utils/transactionSave";
// chart masters for account dropdown
// dynamic import to match pattern used in WorkOrderEntry
import { useQueryClient } from "@tanstack/react-query";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { useAuth } from "../../../../context/AuthContext";

export default function CostWorkOrder() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Work order releases');
  const navigate = useNavigate();
  const location = useLocation();
  const idFromState = (location.state as any)?.id ?? null;

  const { data: locations = [] } = useQuery({ queryKey: ["inventoryLocations"], queryFn: getInventoryLocations });
  const { data: workCentres = [] } = useQuery({ queryKey: ["workCentres"], queryFn: getWorkCentres });

  const [loadingError, setLoadingError] = useState("");
  const [woRecord, setWoRecord] = useState<any | null>(null);

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
        setWoRecord(wo);
        try {
          const locCode = wo.loc_code ?? wo.location ?? wo.loc ?? "";
          if (locCode) setFromLocation(String(locCode));
        } catch (e) {}
      } catch (err) {
        console.warn("Failed to load work order:", err);
        setLoadingError("Failed to load work order");
      }
    })();
  }, [idFromState]);

  // default select first inventory location when locations load (if none already set)
  useEffect(() => {
    try {
      if ((!fromLocationState || String(fromLocationState) === "") && Array.isArray(locations) && locations.length > 0) {
        const first = locations[0];
        const val = first.loc_code ?? first.id ?? "";
        if (val) setFromLocation(String(val));
      }
    } catch (e) {
      // ignore
    }
  }, [locations]);

  // default select first work centre when workCentres load
  useEffect(() => {
    try {
      if ((!toWorkCentre || String(toWorkCentre) === "") && Array.isArray(workCentres) && workCentres.length > 0) {
        const first = workCentres[0];
        const val = first.id ?? first.work_centre_id ?? first.workCentreId ?? "";
        if (val) setToWorkCentre(String(val));
      }
    } catch (e) {
      // ignore
    }
  }, [workCentres]);

  // Issue form state
  const today = new Date().toISOString().split("T")[0];
  const [issueDate, setIssueDate] = useState(today);
  const [fromLocationState, setFromLocation] = useState("");
  const [toWorkCentre, setToWorkCentre] = useState("");
  const [issueReference, setIssueReference] = useState("YYYY");
  const [issueType, setIssueType] = useState("labour");
  const [issueMemo, setIssueMemo] = useState("");
  const [additionalCosts, setAdditionalCosts] = useState("0.00");
  const [creditAccount, setCreditAccount] = useState("");
  const [formError, setFormError] = useState("");

  const queryClient = useQueryClient();

  // chart masters for credit account dropdown
  const { data: chartMasters = [] } = useQuery({ queryKey: ["chartMasters"], queryFn: () => import("../../../../api/GLAccounts/ChartMasterApi").then((m) => m.getChartMasters()) });

  const accountTypeMap: Record<string, string> = {
    "1": "Current Assets",
    "2": "Inventory Assets",
    "3": "Capital Assets",
    "4": "Current Liabilities",
    "5": "Long Term Liabilities",
    "6": "Share Capital",
    "7": "Retained Earnings",
    "8": "Sales Revenue",
    "9": "Other Revenue",
    "10": "Cost of Good Sold",
    "11": "Payroll Expenses",
    "12": "General and Adminitrative Expenses",
  };

  const groupedChartMasters = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (chartMasters as any[]).forEach((acc: any) => {
      const typeText = accountTypeMap[String(acc.account_type)] || "Unknown";
      if (!groups[typeText]) groups[typeText] = [];
      groups[typeText].push(acc);
    });
    return groups;
  }, [chartMasters]);

  // default credit account to first available chart master when loaded
  useEffect(() => {
    try {
      if ((!creditAccount || String(creditAccount) === "") && Array.isArray(chartMasters) && chartMasters.length > 0) {
        const all = Object.values(groupedChartMasters).flat();
        if (all.length > 0) {
          const first = all[0];
          const val = first.account_code ?? first.accountCode ?? first.id ?? first.code ?? first.account_number ?? first.account_no ?? "";
          if (val) setCreditAccount(String(val));
        }
      }
    } catch (e) {
      // ignore
    }
  }, [groupedChartMasters, chartMasters]);

  const getTypeLabel = (t: any) => {
    const n = Number(t);
    if (n === 0) return "Assemble";
    if (n === 1) return "Unassemble";
    if (n === 2) return "Advanced Manufacture";
    return String(t ?? "");
  };

  const itemLabel = (stockId: any) => {
    const rec = (woRecord || {});
    return rec ? (rec.item_name ?? rec.name ?? String(stockId)) : String(stockId ?? "");
  };

  const locLabel = (locCode: any) => {
    const rec = (locations || []).find((l: any) => String(l.loc_code ?? l.loccode ?? l.code ?? "") === String(locCode));
    return rec ? (rec.location_name ?? String(locCode)) : String(locCode ?? "");
  };

  const handleProcessAdditionalCost = async () => {
    // clear previous errors
    setFormError("");

    // basic validation: required fields (except memo)
    if (!issueDate) {
      setFormError("Select a date");
      return;
    }
    if (!issueReference || String(issueReference).trim() === "") {
      setFormError("Enter a reference");
      return;
    }
    if (!issueType || String(issueType).trim() === "") {
      setFormError("Select a type");
      return;
    }
    if (!additionalCosts || String(additionalCosts).trim() === "") {
      setFormError("Enter additional costs");
      return;
    }
    if (!creditAccount) {
      setFormError("Select credit account");
      return;
    }
    if (!idFromState) {
      setFormError("Work order id missing");
      return;
    }

    // parse amounts
    const amt = Number(String(additionalCosts).replace(/,/g, "")) || 0;
    if (isNaN(amt) || amt <= 0) {
      setFormError("Enter a valid additional cost amount");
      return;
    }

    try {
      const saveResult = await runTransactionSave(async () =>
        postWorkOrderCost({
          workorder_id: Number(idFromState),
          reference: issueReference,
          date: issueDate,
          amount: amt,
          cost_type: issueType === "labour" ? 0 : 1,
          credit_account: creditAccount,
          memo: issueMemo || undefined,
        })
      );

      if (saveResult.ok === false) {
        setFormError(saveResult.message);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      navigate("/manufacturing/transactions/work-order-entry/success", {
        state: { reference: issueReference, id: idFromState, successMode: "cost" },
      });
    } catch (err) {
      console.error("Failed processing additional cost:", err);
      setFormError("Failed to process additional cost.");
    }
  };

  const breadcrumbItems = [
    { title: "Transactions", href: "/manufacturing/transactions" },
    { title: "Cost Work Order" },
  ];

  return (
    <FormPageLayout>
      <Box sx={{ padding: theme.spacing(2), boxShadow: 2, borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Box>
          <PageTitle title="Work Order Additional Costs" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>
      </Box>
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        {loadingError && <Alert severity="error">{loadingError}</Alert>}

        <Grid container>
          <Grid item xs={12}>
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Manufactured Item</TableCell>
                    <TableCell>Into Location</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Required by</TableCell>
                    <TableCell>Quantity required</TableCell>
                    <TableCell>Released date</TableCell>
                    <TableCell>Manufactured</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {woRecord ? (
                    <TableRow hover>
                      <TableCell>{woRecord.id ?? woRecord.wo_id ?? ""}</TableCell>
                      <TableCell>{woRecord.wo_ref ?? woRecord.reference ?? ""}</TableCell>
                      <TableCell>{getTypeLabel(woRecord.type)}</TableCell>
                      <TableCell>{itemLabel(woRecord.stock_id ?? woRecord.stock ?? woRecord.item_id)}</TableCell>
                      <TableCell>{locLabel(woRecord.loc_code ?? woRecord.location ?? woRecord.loc)}</TableCell>
                      <TableCell>{woRecord.date ? String(woRecord.date).split("T")[0] : (woRecord.tran_date ?? "")}</TableCell>
                      <TableCell>{woRecord.required_by ?? woRecord.date_required_by ?? woRecord.requiredBy ?? ""}</TableCell>
                      <TableCell>{Number(woRecord.units_reqd ?? woRecord.quantity ?? woRecord.units_req ?? 0)}</TableCell>
                      <TableCell>{woRecord.released_date ? String(woRecord.released_date).split("T")[0] : ""}</TableCell>
                      <TableCell>{Number(woRecord.units_issued ?? woRecord.unitsIssued ?? 0)}</TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10}>No work order selected</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Issue form (no items table) */}
          <Grid item xs={12} sx={{ mt: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField label="Date" type="date" fullWidth size="small" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" label="Reference" value={issueReference} onChange={(e) => setIssueReference(e.target.value)} />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField select fullWidth size="small" label="Credit Account" value={creditAccount} onChange={(e) => setCreditAccount(String(e.target.value))}>
                    <MenuItem value="">Select</MenuItem>
                    {Object.entries(groupedChartMasters).map(([grp, accs]) => {
                      return [
                        <ListSubheader key={`grp-${grp}`}>{grp}</ListSubheader>,
                        accs.map((a: any) => (
                          <MenuItem key={a.account_code ?? a.id} value={a.account_code ?? a.id}>{`${a.account_code ?? a.code} ${a.account_name ?? a.description ?? a.name}`}</MenuItem>
                        )),
                      ];
                    })}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField select fullWidth size="small" label="Type" value={issueType} onChange={(e) => setIssueType(String(e.target.value))}>
                    <MenuItem value="labour">Labour Cost</MenuItem>
                    <MenuItem value="overhead">Overhead Cost</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" label="Additional costs" value={additionalCosts} onChange={(e) => setAdditionalCosts(e.target.value)} />
                </Grid>

                <Grid item xs={12}>
                  <TextField label="Memo" fullWidth multiline rows={3} value={issueMemo} onChange={(e) => setIssueMemo(e.target.value)} />
                </Grid>

                {formError && (
                  <Grid item xs={12}>
                    <Alert severity="warning">{formError}</Alert>
                  </Grid>
                )}

                <Grid item xs={12} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                  <Button disabled={!canEdit} variant="contained" color="primary" onClick={handleProcessAdditionalCost}>Process additional cost</Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </FormPageLayout>
  );
}
