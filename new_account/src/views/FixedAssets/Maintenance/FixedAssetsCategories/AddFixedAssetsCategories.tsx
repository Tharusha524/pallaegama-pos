import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  Button,
  Paper,
  useMediaQuery,
  useTheme,
  ListSubheader,
} from "@mui/material";
import theme from "../../../../theme";
import { getChartMasters } from "../../../../api/GLAccounts/ChartMasterApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { getItemTaxTypes } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { createItemCategory } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getCostCenters } from "../../../../api/CostCenter/CostCenterApi";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface ItemCategoriesFormData {
  categoryName: string;
  itemTaxType: string;
  unitOfMeasure: string;
  excludeFromPurchases: boolean;
  salesAccount: string;
  inventoryAccount: string;
  cogsAccount: string;
  inventoryAdjustmentAccount: string;
  costCenter: string;
}

export default function AddFixedAssetsCategories() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fixed Asset categories');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<ItemCategoriesFormData>({
    categoryName: "",
    itemTaxType: "",
    unitOfMeasure: "",
    excludeFromPurchases: false,
    salesAccount: "",
    inventoryAccount: "",
    cogsAccount: "",
    inventoryAdjustmentAccount: "",
    costCenter: "",
  });

  const accountTypeMap: { [key: number]: string } = {
    1: "Current Assets",
    2: "Inventory Assets",
    3: "Capital Assets",
    4: "Current Liabilities",
    5: "Long Term Liabilities",
    6: "Share Capital",
    7: "Retained Earnings",
    8: "Sales Revenue",
    9: "Other Revenue",
    10: "Cost of Good Sold",
    11: "Payroll Expenses",
    12: "General and Administrative Expenses",
  };

  const [itemCategories, setItemCategories] = useState([]);
  const [chartMasters, setChartMasters] = useState<any[]>([]);
  const [itemTaxTypes, setItemTaxTypes] = useState<any[]>([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [errors, setErrors] = useState<Partial<ItemCategoriesFormData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));


  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [chartMastersRes, taxTypesRes, unitsRes, costCentersRes] = await Promise.all([
          getChartMasters(),
          getItemTaxTypes(),
          getItemUnits(),
          getCostCenters(),
        ]);

        const filteredTaxTypes = (taxTypesRes || []).filter((type) => !type.inactive);
        const filteredUnits = (unitsRes || []).filter((unit) => !unit.inactive);

        setChartMasters(chartMastersRes || []);
        setItemTaxTypes(filteredTaxTypes);
        setUnitsOfMeasure(filteredUnits);
        setCostCenters(costCentersRes || []);

        // Set default values for dropdowns
        setFormData((prev) => ({
          ...prev,
          itemTaxType: filteredTaxTypes.length > 0 ? String(filteredTaxTypes[0].id) : "",
          unitOfMeasure: filteredUnits.length > 0 ? String(filteredUnits[0].id) : "",
          salesAccount: chartMastersRes.find((acc) => acc.account_code === "4010")?.account_code || "",
          inventoryAccount: chartMastersRes.find((acc) => acc.account_code === "1510")?.account_code || "",
          cogsAccount: chartMastersRes.find((acc) => acc.account_code === "5010")?.account_code || "",
          inventoryAdjustmentAccount: chartMastersRes.find((acc) => acc.account_code === "5040")?.account_code || "",
        }));
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({ ...formData, [name]: checked });
  };

  const validate = () => {
    const newErrors: Partial<ItemCategoriesFormData> = {};
    if (!formData.categoryName) newErrors.categoryName = "Category Name is required";
    if (!formData.itemTaxType) newErrors.itemTaxType = "Select Item Tax Type";
    if (!formData.unitOfMeasure) newErrors.unitOfMeasure = "Select Unit of Measure";
    if (!formData.salesAccount) newErrors.salesAccount = "Select Sales Account";
    if (!formData.inventoryAccount) newErrors.inventoryAccount = "Select Asset Account";
    if (!formData.cogsAccount) newErrors.cogsAccount = "Select Depreciation Cost Account";
    if (!formData.inventoryAdjustmentAccount)
      newErrors.inventoryAdjustmentAccount = "Select Depreciation/Disposal Account";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      description: formData.categoryName,
      dflt_tax_type: parseInt(formData.itemTaxType),
      dflt_mb_flag: 4, // Fixed Assets
      dflt_units: parseInt(formData.unitOfMeasure),
      dflt_sales_act: formData.salesAccount,
      dflt_inventory_act: formData.inventoryAccount,
      dflt_cogs_act: formData.cogsAccount,
      dflt_adjustment_act: formData.inventoryAdjustmentAccount,
      dflt_wip_act: '1530',
      dflt_dim1: null,
      dflt_dim2: null,
      inactive: 0,
      dflt_no_sale: 0,
      dflt_no_purchase: formData.excludeFromPurchases ? 1 : 0,
    };

    try {
      const res = await createItemCategory(payload);
      // alert("Fixed Assets Category added successfully!");
      setOpen(true);
      console.log("Created:", res);
      queryClient.invalidateQueries({ queryKey: ["itemCategories"], exact: false });
    } catch (err) {
      console.error("Failed to create item category:", err);
      //  alert("Failed to add Fixed Assets Category.");
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          maxWidth: "600px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Add Fixed Assets Category
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Category Name"
            name="categoryName"
            size="small"
            fullWidth
            value={formData.categoryName}
            onChange={handleInputChange}
            error={!!errors.categoryName}
            helperText={errors.categoryName || " "}
          />

          <FormControl size="small" fullWidth error={!!errors.itemTaxType}>
            <InputLabel>Item Tax Type</InputLabel>
            <Select
              name="itemTaxType"
              value={formData.itemTaxType}
              onChange={handleSelectChange}
              label="Item Tax Type"
            >
              {itemTaxTypes.map((type) => (
                <MenuItem key={type.id} value={String(type.id)}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.itemTaxType || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.unitOfMeasure}>
            <InputLabel>Unit of Measure</InputLabel>
            <Select
              name="unitOfMeasure"
              value={formData.unitOfMeasure}
              onChange={handleSelectChange}
              label="Unit of Measure"
            >
              {unitsOfMeasure.map((unit) => (
                <MenuItem key={unit.id} value={String(unit.id)}>
                  {unit.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.unitOfMeasure || " "}</FormHelperText>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                name="excludeFromPurchases"
                checked={formData.excludeFromPurchases}
                onChange={handleCheckboxChange}
              />
            }
            label="Exclude from purchases"
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Cost Center</InputLabel>
            <Select
              name="costCenter"
              value={formData.costCenter}
              onChange={handleSelectChange}
              label="Cost Center"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {costCenters.map((dim: any) => (
                <MenuItem key={dim.id} value={String(dim.id)}>
                  {dim.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.salesAccount}>
            <InputLabel>Sales Account</InputLabel>
            <Select
              name="salesAccount"
              value={formData.salesAccount}
              onChange={handleSelectChange}
              label="Sales Account"
            >
              {(() => {
                const groupedAccounts: { [key: string]: any[] } = {};
                chartMasters.forEach((acc) => {
                  const type = acc.account_type || "Unknown";
                  if (!groupedAccounts[type]) groupedAccounts[type] = [];
                  groupedAccounts[type].push(acc);
                });

                return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                  const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                  return [
                    <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                    ...accounts.map((acc) => (
                      <MenuItem key={acc.account_code} value={acc.account_code}>
                        <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                          {acc.account_code} - {acc.account_name}
                        </Stack>
                      </MenuItem>
                    )),
                  ];
                });
              })()}
            </Select>
            <FormHelperText>{errors.salesAccount || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.inventoryAccount}>
            <InputLabel>Asset Account</InputLabel>
            <Select
              name="inventoryAccount"
              value={formData.inventoryAccount}
              onChange={handleSelectChange}
              label="Asset Account"
            >
              {(() => {
                const groupedAccounts: { [key: string]: any[] } = {};
                chartMasters.forEach((acc) => {
                  const type = acc.account_type || "Unknown";
                  if (!groupedAccounts[type]) groupedAccounts[type] = [];
                  groupedAccounts[type].push(acc);
                });

                return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                  const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                  return [
                    <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                    ...accounts.map((acc) => (
                      <MenuItem key={acc.account_code} value={acc.account_code}>
                        <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                          {acc.account_code} - {acc.account_name}
                        </Stack>
                      </MenuItem>
                    )),
                  ];
                });
              })()}
            </Select>
            <FormHelperText>{errors.inventoryAccount || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.cogsAccount}>
            <InputLabel>Depreciation Cost Account</InputLabel>
            <Select
              name="cogsAccount"
              value={formData.cogsAccount}
              onChange={handleSelectChange}
              label="Depreciation Cost Account"
            >
              {(() => {
                const groupedAccounts: { [key: string]: any[] } = {};
                chartMasters.forEach((acc) => {
                  const type = acc.account_type || "Unknown";
                  if (!groupedAccounts[type]) groupedAccounts[type] = [];
                  groupedAccounts[type].push(acc);
                });

                return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                  const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                  return [
                    <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                    ...accounts.map((acc) => (
                      <MenuItem key={acc.account_code} value={acc.account_code}>
                        <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                          {acc.account_code} - {acc.account_name}
                        </Stack>
                      </MenuItem>
                    )),
                  ];
                });
              })()}
            </Select>
            <FormHelperText>{errors.cogsAccount || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.inventoryAdjustmentAccount}>
            <InputLabel>Depreciation/Disposal Account</InputLabel>
            <Select
              name="inventoryAdjustmentAccount"
              value={formData.inventoryAdjustmentAccount}
              onChange={handleSelectChange}
              label="Depreciation/Disposal Account"
            >
              {(() => {
                const groupedAccounts: { [key: string]: any[] } = {};
                chartMasters.forEach((acc) => {
                  const type = acc.account_type || "Unknown";
                  if (!groupedAccounts[type]) groupedAccounts[type] = [];
                  groupedAccounts[type].push(acc);
                });

                return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                  const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                  return [
                    <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                    ...accounts.map((acc) => (
                      <MenuItem key={acc.account_code} value={acc.account_code}>
                        <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                          {acc.account_code} - {acc.account_name}
                        </Stack>
                      </MenuItem>
                    )),
                  ];
                });
              })()}
            </Select>
            <FormHelperText>{errors.inventoryAdjustmentAccount || " "}</FormHelperText>
          </FormControl>
        </Stack>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 3,
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 2 : 0,
          }}
        >
          <Button onClick={() => window.history.back()}>Back</Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Fixed Assets Category has been added successfully!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => {
          // Form was already cleared on successful submission
          window.history.back();
        }}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}