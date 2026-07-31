import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Stack,
  Paper,
  TextField,
  MenuItem,
  Grid,
  Alert,
  ListSubheader,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
// import { getGLAccounts } from "../../../../api/GLAccounts/GLAccountsApi";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { useQueryClient } from "@tanstack/react-query";
import { getWorkOrders } from "../../../../api/WorkOrders/WorkOrderApi";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import { getBomsByParent } from "../../../../api/Bom/BomApi";
import { postWorkOrderEntry } from "../../../../api/Manufacturing/ManufacturingApi";
import { runTransactionSave, assertPersistedResponse } from "../../../../utils/transactionSave";
import ItemSearchSelect from "../../../../components/ItemSearchSelect";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function WorkOrderEntry() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Work order entry');
  const navigate = useNavigate();

  // Queries
  const { data: locations = [] } = useQuery({ queryKey: ["inventoryLocations"], queryFn: getInventoryLocations });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: categories = [] } = useQuery<{ category_id: number; description: string }[]>({
    queryKey: ["itemCategories"],
    queryFn: () => getItemCategories() as Promise<{ category_id: number; description: string }[]>,
  });
  const { data: chartMasters = [] } = useQuery({
    queryKey: ["chartMasters"],
    queryFn: () => import("../../../../api/GLAccounts/ChartMasterApi").then(m => m.getChartMasters()),
  });

  const queryClient = useQueryClient();

  // Map of account type ids to descriptive text (used to group the dropdown)
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

  // Group chart masters by descriptive account type for the select dropdown
  const groupedChartMasters = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (chartMasters as any[]).forEach((acc: any) => {
      const typeText = accountTypeMap[String(acc.account_type)] || "Unknown";
      if (!groups[typeText]) groups[typeText] = [];
      groups[typeText].push(acc);
    });
    // sort each group's accounts by account_code for stable order
    Object.values(groups).forEach((arr) => arr.sort((a: any, b: any) => (String(a.account_code || "")).localeCompare(String(b.account_code || ""))));
    return groups;
  }, [chartMasters]);

  // Only include manufacturable items for the Select dropdown (mb_flag === 1)
  const manufacturableItems = useMemo(() => {
    return (items || []).filter((it: any) => Number(it.mb_flag) === 1);
  }, [items]);
  // Form fields
  const [reference, setReference] = useState("");
  const [type, setType] = useState<number | string>("");
  const [itemCode, setItemCode] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dateRequiredBy, setDateRequiredBy] = useState("");
  const [labourCost, setLabourCost] = useState("0.00");
  const [creditLabourAccount, setCreditLabourAccount] = useState("");
  const [overheadCost, setOverheadCost] = useState("0.00");
  const [creditOverheadAccount, setCreditOverheadAccount] = useState("");
  const [memo, setMemo] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [openLabourAccountSelect, setOpenLabourAccountSelect] = useState(false);
  const [openOverheadAccountSelect, setOpenOverheadAccountSelect] = useState(false);

  // Update item code when selected item changes
  useEffect(() => {
    if (!selectedItem) {
      setItemCode("");
      return;
    }
    const it = (items || []).find((i: any) => String(i.stock_id ?? i.id) === String(selectedItem));
    setItemCode(it ? String(it.stock_id ?? it.id ?? "") : "");

    // populate labour and overhead costs from the selected item if available
    if (it) {
      const rawLabour = it.labour_cost ?? it.labourCost ?? it.standard_labour_cost ?? it.labour_cost_local ?? 0;
      const rawOverhead = it.overhead_cost ?? it.overheadCost ?? it.standard_overhead_cost ?? 0;
      const labourVal = Number(rawLabour);
      const overheadVal = Number(rawOverhead);
      setLabourCost(!isNaN(labourVal) ? labourVal.toFixed(2) : "0.00");
      setOverheadCost(!isNaN(overheadVal) ? overheadVal.toFixed(2) : "0.00");
    } else {
      setLabourCost("0.00");
      setOverheadCost("0.00");
    }
  }, [selectedItem, items]);

  // Set defaults for dropdowns to first available option when data loads
  useEffect(() => {
    if (!type) {
      setType(0);
    }
  }, [type]);

  useEffect(() => {
    if (!selectedItem && manufacturableItems && manufacturableItems.length > 0) {
      const first = manufacturableItems[0];
      const stockId = first.stock_id ?? first.id ?? first.stock_master_id ?? first.item_id ?? "";
      if (stockId !== "") setSelectedItem(String(stockId));
    }
  }, [manufacturableItems, selectedItem]);

  useEffect(() => {
    if (!destinationLocation && locations && locations.length > 0) {
      const firstLoc = locations[0];
      if (firstLoc?.loc_code) setDestinationLocation(firstLoc.loc_code);
    }
  }, [locations, destinationLocation]);

  // Fiscal years used to build fiscal-year-aware reference like PurchaseOrderEntry
  const { data: fiscalYears = [] } = useQuery({ queryKey: ["fiscalYears"], queryFn: getFiscalYears });
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: getCompanies });

  useEffect(() => {
    (async () => {
      // prefer company setup fiscal year if available
      try {
        let yearLabel: string | null = null;

        const company = Array.isArray(companies) && companies.length > 0 ? companies[0] : null;
        const companyFiscalId = company?.fiscal_year_id ?? company?.fiscal_year ?? null;

        if (companyFiscalId && fiscalYears && fiscalYears.length > 0) {
          const chosenFy = fiscalYears.find((fy: any) => String(fy.id ?? fy.fiscal_year_id ?? fy.fiscal_year) === String(companyFiscalId));
          if (chosenFy) {
            const fromYear = chosenFy.fiscal_year_from ? new Date(chosenFy.fiscal_year_from).getFullYear() : null;
            const toYear = chosenFy.fiscal_year_to ? new Date(chosenFy.fiscal_year_to).getFullYear() : fromYear;
            yearLabel = chosenFy.fiscal_year || (fromYear && toYear ? (fromYear === toYear ? String(fromYear) : `${fromYear}-${toYear}`) : String(new Date().getFullYear()));
          }
        }

        // fallback: use date to determine fiscal year if we don't have company-configured fiscal year
        if (!yearLabel) {
          if (!date) return;
          const dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) return;

          yearLabel = String(dateObj.getFullYear());
          if (fiscalYears && fiscalYears.length > 0) {
            const matching = fiscalYears.find((fy: any) => {
              if (!fy.fiscal_year_from || !fy.fiscal_year_to) return false;
              const from = new Date(fy.fiscal_year_from);
              const to = new Date(fy.fiscal_year_to);
              if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
              return dateObj >= from && dateObj <= to;
            });

            const chosen = matching || [...fiscalYears]
              .filter((fy: any) => fy.fiscal_year_from && !isNaN(new Date(fy.fiscal_year_from).getTime()))
              .sort((a: any, b: any) => new Date(b.fiscal_year_from).getTime() - new Date(a.fiscal_year_from).getTime())
              .find((fy: any) => new Date(fy.fiscal_year_from) <= dateObj) || fiscalYears[0];

            if (chosen) {
              const fromYear = chosen.fiscal_year_from ? new Date(chosen.fiscal_year_from).getFullYear() : dateObj.getFullYear();
              const toYear = chosen.fiscal_year_to ? new Date(chosen.fiscal_year_to).getFullYear() : fromYear;
              yearLabel = chosen.fiscal_year || (fromYear === toYear ? String(fromYear) : `${fromYear}-${toYear}`);
            }
          }
        }

        // find next sequential number for work orders in that fiscal year
        const allWOs = await getWorkOrders();
        let nextNum = 1;
        if (Array.isArray(allWOs) && allWOs.length > 0 && yearLabel) {
          const yearPattern = `/${yearLabel}`;
          const matchingRefs = allWOs
            .map((w: any) => w.wo_ref ?? w.reference ?? "")
            .filter((ref: string) => String(ref).endsWith(yearPattern))
            .map((ref: string) => {
              const parts = String(ref).split('/');
              if (parts.length >= 2) {
                const numPart = parts[0];
                const parsed = parseInt(numPart, 10);
                return isNaN(parsed) ? 0 : parsed;
              }
              return 0;
            })
            .filter((n: number) => n > 0);
          if (matchingRefs.length > 0) {
            const maxRef = Math.max(...matchingRefs);
            nextNum = maxRef + 1;
          }
        }
        if (yearLabel) setReference(`${nextNum.toString().padStart(3, '0')}/${yearLabel}`);
      } catch (err) {
        console.warn('Failed to fetch work orders for reference generation', err);
      }
    })();
  }, [date, fiscalYears, companies]);

  useEffect(() => {
    // pick the first available account from groupedChartMasters for both labour and overhead
    if ((!creditLabourAccount || !creditOverheadAccount) && Object.keys(groupedChartMasters).length > 0) {
      const allAccounts = Object.values(groupedChartMasters).flat();
      if (allAccounts.length > 0) {
        const accCode = allAccounts[0].account_code ?? allAccounts[0].accountCode ?? "";
        if (accCode) {
          if (!creditLabourAccount) setCreditLabourAccount(String(accCode));
          if (!creditOverheadAccount) setCreditOverheadAccount(String(accCode));
        }
      }
    }
  }, [groupedChartMasters, creditLabourAccount, creditOverheadAccount]);

  const handleAddWorkOrder = async () => {
    // Validation
    if (!reference) {
      setSaveError("Please enter a reference");
      return;
    }
    if (type === "" || type === null || typeof type === "undefined" || isNaN(Number(type))) {
      setSaveError("Please select a type");
      return;
    }
    if (!selectedItem) {
      setSaveError("Please select an item");
      return;
    }
    if (!destinationLocation) {
      setSaveError("Please select a destination location");
      return;
    }
    if (!quantity) {
      setSaveError("Please enter the quantity");
      return;
    }
    if (Number(quantity) <= 0) {
      setSaveError("Quantity must be greater than 0");
      return;
    }
    if (!date) {
      setSaveError("Please select a date");
      return;
    }
    if (Number(type) === 2 && !dateRequiredBy) {
      setSaveError("Please select Date Required By");
      return;
    }

    // Prevent creating work orders if the selected fiscal year is closed (closed === 1)
    try {
      let chosenFy: any | null = null;
      const company = Array.isArray(companies) && companies.length > 0 ? companies[0] : null;
      const companyFiscalId = company?.fiscal_year_id ?? company?.fiscal_year ?? null;
      if (companyFiscalId && Array.isArray(fiscalYears) && fiscalYears.length > 0) {
        chosenFy = fiscalYears.find((fy: any) => String(fy.id ?? fy.fiscal_year_id ?? fy.fiscal_year) === String(companyFiscalId));
      }

      if (!chosenFy) {
        // fallback: find fiscal year that contains the selected date
        if (date) {
          const dateObj = new Date(date);
          if (!isNaN(dateObj.getTime()) && Array.isArray(fiscalYears)) {
            chosenFy = fiscalYears.find((fy: any) => {
              if (!fy.fiscal_year_from || !fy.fiscal_year_to) return false;
              const from = new Date(fy.fiscal_year_from);
              const to = new Date(fy.fiscal_year_to);
              if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
              return dateObj >= from && dateObj <= to;
            }) || null;
          }
        }
      }

      // If company has a configured fiscal year, ensure the entered date is within it and it's not closed
      try {
        if (companyFiscalId && chosenFy) {
          if (date) {
            const dateObj = new Date(date);
            const from = chosenFy.fiscal_year_from ? new Date(chosenFy.fiscal_year_from) : null;
            const to = chosenFy.fiscal_year_to ? new Date(chosenFy.fiscal_year_to) : null;
            const outOfRange = !from || !to || isNaN(from.getTime()) || isNaN(to.getTime()) || dateObj < from || dateObj > to;
            const closed = Number(chosenFy.closed) === 1;
            if (outOfRange || closed) {
              setSaveError("The entered date is out of fiscal year or is closed for further data entry.");
              return;
            }
          }
        }
      } catch (fyCheckErr) {
        console.warn("Failed to validate company fiscal year date check:", fyCheckErr);
      }

      if (chosenFy && Number(chosenFy.closed) === 1) {
        setSaveError("The selected fiscal year is closed. Cannot create work order.");
        return;
      }
      // determine fiscalYearId for audit trail entries - prefer company configured fiscal year
      var fiscalYearIdForAudit: any = null;
      if (companyFiscalId) {
        fiscalYearIdForAudit = companyFiscalId;
      } else if (chosenFy) {
        fiscalYearIdForAudit = chosenFy?.id ?? chosenFy?.fiscal_year_id ?? null;
      } else {
        try {
          if (date && Array.isArray(fiscalYears) && fiscalYears.length > 0) {
            const dateObj = new Date(date);
            const matching = fiscalYears.find((fy: any) => {
              if (!fy.fiscal_year_from || !fy.fiscal_year_to) return false;
              const from = new Date(fy.fiscal_year_from);
              const to = new Date(fy.fiscal_year_to);
              if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
              return dateObj >= from && dateObj <= to;
            });
            const chosen = matching || fiscalYears[0];
            fiscalYearIdForAudit = chosen?.id ?? chosen?.fiscal_year_id ?? null;
          }
        } catch (fyErr) {
          console.warn("Failed to determine fiscal year for audit trail:", fyErr);
        }
      }
    } catch (err) {
      console.warn("Fiscal year check failed:", err);
    }

    // Before saving, ensure BOM components are available in the destination location
    try {
      const parentCode = String(itemCode || selectedItem || "").trim();
      if (parentCode) {
        let matches: any[] = [];
        try {
          matches = await getBomsByParent(parentCode, destinationLocation);
        } catch (bomLoadErr) {
          console.warn("Failed to load BOM for work order:", bomLoadErr);
          setSaveError("Could not load Bills of Material. Check your connection and try again.");
          return;
        }
        // if this is not an advanced work order, require a BOM to exist
        if (Number(type) !== 2 && matches.length === 0) {
          const itemLabel =
            (items || []).find((it: any) => String(it.stock_id ?? it.id) === parentCode)?.item_name ??
            (items || []).find((it: any) => String(it.stock_id ?? it.id) === parentCode)?.description ??
            parentCode;
          setSaveError(
            `The selected item (${itemLabel}) does not have a Bill of Materials. Add components in Manufacturing → Maintenance → Bills of Material, or use Type "Advanced Manufacture" if no BOM is required.`
          );
          return;
        }
        // Stock is checked when issuing/producing — allow WO creation even if QOH is zero.
      }
    } catch (chkErr) {
      console.warn("Failed to verify BOM availability:", chkErr);
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const labourAmt = Number(labourCost || 0);
      const overheadAmt = Number(overheadCost || 0);

      const saveResult = await runTransactionSave(async () => {
        const res = await postWorkOrderEntry({
          wo_ref: reference,
          loc_code: destinationLocation,
          units_reqd: Number(quantity),
          stock_id: String(selectedItem || itemCode || ""),
          date,
          type: Number(type),
          required_by: Number(type) === 2 ? (dateRequiredBy || date) : date,
          memo: memo?.trim() || undefined,
          labour_cost: !isNaN(labourAmt) && labourAmt > 0 ? labourAmt : undefined,
          labour_credit_account: labourAmt > 0 ? creditLabourAccount || undefined : undefined,
          overhead_cost: !isNaN(overheadAmt) && overheadAmt > 0 ? overheadAmt : undefined,
          overhead_credit_account: overheadAmt > 0 ? creditOverheadAccount || undefined : undefined,
        });
        assertPersistedResponse(res as Record<string, unknown>, ["id", "wo_ref"]);
        return res;
      });

      if (saveResult.ok === false) {
        setSaveError(saveResult.message);
        return;
      }

      try {
        queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      } catch {
        // ignore
      }

      const createdWoId = (saveResult.data as { id?: number })?.id;
      navigate("/manufacturing/transactions/work-order-entry/success", {
        state: { reference, id: createdWoId, type: Number(type) },
      });
    } catch (error: unknown) {
      console.error("Error creating work order:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to create work order");
    } finally {
      setIsSaving(false);
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Work Order Entry" },
  ];

  return (
    <FormPageLayout>
      {/* Header */}
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
          <PageTitle title="Work Order Entry" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </Box>
      {/* Work Order Form */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Reference"
              fullWidth
              size="small"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Type"
              fullWidth
              size="small"
              value={type}
              onChange={(e) => setType(Number((e.target as HTMLInputElement).value))}
            >
              <MenuItem value={0}>Assemble</MenuItem>
              <MenuItem value={1}>Unassemble</MenuItem>
              <MenuItem value={2}>Advanced Manufacture</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              {Number(type) === 2 ? (
                <>
                  <strong>Advanced Manufacture</strong> creates an open work order only. After save, go to{" "}
                  <strong>Transactions → Outstanding Work Orders</strong> to Release, Issue, add Costs, and Produce
                  (same as FrontAccounting).
                </>
              ) : Number(type) === 1 ? (
                <>
                  <strong>Unassemble</strong> breaks finished goods into components in one step (auto release, produce, and close).
                  View completed orders under <strong>Inquiries → Work Order Inquiry</strong>.
                </>
              ) : (
                <>
                  <strong>Assemble</strong> builds finished goods in one step (auto release, produce, and close).
                  View completed orders under <strong>Inquiries → Work Order Inquiry</strong>, not Outstanding Work Orders.
                </>
              )}
            </Alert>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Item Code"
                  fullWidth
                  size="small"
                  value={itemCode}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <ItemSearchSelect
                  label="Select Item"
                  selectedStockId={selectedItem}
                  value={
                    manufacturableItems.find(
                      (it: any) => String(it.stock_id ?? it.id) === String(selectedItem)
                    )?.description ?? ""
                  }
                  items={manufacturableItems as any[]}
                  categories={categories.map((cat) => ({
                    id: cat.category_id,
                    category_name: cat.description,
                  }))}
                  onSelect={(item) => {
                    if (item) {
                      setSelectedItem(item.stock_id);
                      setItemCode(item.stock_id);
                    } else {
                      setSelectedItem("");
                      setItemCode("");
                    }
                  }}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Destination Location"
              fullWidth
              size="small"
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
            >
              <MenuItem value="">Select location</MenuItem>
              {(locations || []).map((loc: any) => (
                <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {Number(type) === 2 ? (
            <>
              <Grid item xs={12} sm={6}>
                <FormattedNumberField
                  label="Quantity Required"
                  fullWidth
                  size="small"
                  inputProps={{ min: 0 }}
                  value={quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || v === "-") return setQuantity("");
                    const n = Number(v);
                    if (isNaN(n)) return;
                    setQuantity(String(Math.max(0, n)));
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date"
                  type="date"
                  fullWidth
                  size="small"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date Required By"
                  type="date"
                  fullWidth
                  size="small"
                  value={dateRequiredBy}
                  onChange={(e) => setDateRequiredBy(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Memo"
                  fullWidth
                  multiline
                  rows={3}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Enter memo or notes..."
                />
              </Grid>
            </>
          ) : (
            <>
              <Grid item xs={12} sm={6}>
                <FormattedNumberField
                  label="Quantity"
                  fullWidth
                  size="small"
                  inputProps={{ min: 0 }}
                  value={quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || v === "-") return setQuantity("");
                    const n = Number(v);
                    if (isNaN(n)) return;
                    setQuantity(String(Math.max(0, n)));
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date"
                  type="date"
                  fullWidth
                  size="small"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormattedNumberField
                  label="Labour Cost"
                  fullWidth
                  size="small"
                  value={labourCost}
                  onChange={(e) => setLabourCost(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Credit Labour Account"
                  fullWidth
                  size="small"
                  value={creditLabourAccount}
                  onChange={(e) => {
                    setCreditLabourAccount(e.target.value);
                    setOpenLabourAccountSelect(false);
                  }}
                  SelectProps={{
                    open: openLabourAccountSelect,
                    onOpen: () => setOpenLabourAccountSelect(true),
                    onClose: () => setOpenLabourAccountSelect(false),
                    renderValue: (value: any) => {
                      if (!value) return "";
                      const found = (chartMasters as any[]).find((c: any) => String(c.account_code) === String(value));
                      return found ? `${found.account_name} - ${found.account_code}` : String(value);
                    },
                  }}
                >
                  <MenuItem value="" onClick={() => {
                    setCreditLabourAccount("");
                    setOpenLabourAccountSelect(false);
                  }}>
                    Select account
                  </MenuItem>
                  {Object.entries(groupedChartMasters).map(([typeText, accounts]) => (
                    <React.Fragment key={typeText}>
                      <ListSubheader>{typeText}</ListSubheader>
                      {accounts.map((acc: any) => (
                        <MenuItem
                          key={String(acc.account_code)}
                          value={String(acc.account_code)}
                          onClick={() => {
                            setCreditLabourAccount(String(acc.account_code));
                            setOpenLabourAccountSelect(false);
                          }}
                        >
                          {acc.account_name} {acc.account_code ? ` - ${acc.account_code}` : ""}
                        </MenuItem>
                      ))}
                    </React.Fragment>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormattedNumberField
                  label="Overhead Cost"
                  fullWidth
                  size="small"
                  value={overheadCost}
                  onChange={(e) => setOverheadCost(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Credit Overhead Account"
                  fullWidth
                  size="small"
                  value={creditOverheadAccount}
                  onChange={(e) => setCreditOverheadAccount(e.target.value)}
                  SelectProps={{
                    open: openOverheadAccountSelect,
                    onOpen: () => setOpenOverheadAccountSelect(true),
                    onClose: () => setOpenOverheadAccountSelect(false),
                    renderValue: (value: any) => {
                      if (!value) return "";
                      const found = (chartMasters as any[]).find((c: any) => String(c.account_code) === String(value));
                      return found ? `${found.account_name} - ${found.account_code}` : String(value);
                    },
                  }}
                >
                  <MenuItem value="" onClick={() => {
                    setCreditOverheadAccount("");
                    setOpenOverheadAccountSelect(false);
                  }}>
                    Select account
                  </MenuItem>
                  {Object.entries(groupedChartMasters).map(([typeText, accounts]) => (
                    <React.Fragment key={typeText}>
                      <ListSubheader>{typeText}</ListSubheader>
                      {accounts.map((acc: any) => (
                        <MenuItem
                          key={String(acc.account_code)}
                          value={String(acc.account_code)}
                          onClick={() => {
                            setCreditOverheadAccount(String(acc.account_code));
                            setOpenOverheadAccountSelect(false);
                          }}
                        >
                          {acc.account_name} {acc.account_code ? ` - ${acc.account_code}` : ""}
                        </MenuItem>
                      ))}
                    </React.Fragment>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Memo"
                  fullWidth
                  multiline
                  rows={3}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Enter memo or notes..."
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>
      {/* Success/Error Messages */}
      {saveError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {saveError}
        </Alert>
      )}
      {/* Submit Button */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, p: 1 }}>
        <Button
          variant="contained"
          color="primary"
          disabled={isSaving || !canEdit}
          onClick={handleAddWorkOrder}
        >
          {isSaving ? "Adding..." : "Add Work Order"}
        </Button>
      </Box>
    </FormPageLayout>
  );
}
