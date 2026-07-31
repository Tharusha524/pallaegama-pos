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
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { resolveAccountCode, resolveCogsAccountCode } from "../../../../utils/stockMasterDefaults";
import { getItemTypes } from "../../../../api/ItemType/ItemType";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";
interface ItemCategoriesFormData {
  categoryName: string;
  itemTaxType: string;
  itemType: string;
  unitOfMeasure: string;
  excludeFromSales: boolean;
  excludeFromPurchases: boolean;
  salesAccount: string;
  inventoryAccount: string;
  cogsAccount: string;
  inventoryAdjustmentAccount: string;
  itemAssemblyCostAccount: string;
}

export default function AddItemCategoriesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Item categories');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<ItemCategoriesFormData>({
    categoryName: "",
    itemTaxType: "",
    itemType: "",
    unitOfMeasure: "",
    excludeFromSales: false,
    excludeFromPurchases: false,
    salesAccount: "",
    inventoryAccount: "",
    cogsAccount: "",
    inventoryAdjustmentAccount: "",
    itemAssemblyCostAccount: "",
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
  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [errors, setErrors] = useState<Partial<ItemCategoriesFormData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const selectedItemType = itemTypes.find((t) => String(t.id) === formData.itemType);
  const isPurchase = selectedItemType?.name?.toLowerCase() === "purchased";
  const isService = selectedItemType?.name?.toLowerCase() === "service";


  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [chartMastersRes, taxTypesRes, unitsRes, itemTypesRes] = await Promise.all([
          getChartMasters(),
          getItemTaxTypes(),
          getItemUnits(),
          getItemTypes(),
        ]);

        const filteredTaxTypes = (taxTypesRes || []).filter((type) => !type.inactive);
        const filteredUnits = (unitsRes || []).filter((unit) => !unit.inactive);

        setChartMasters(chartMastersRes || []);
        setItemTaxTypes(filteredTaxTypes);
        setUnitsOfMeasure(filteredUnits);

        // Exclude item type id=4 from dropdown
        const visibleItemTypes = (itemTypesRes || []).filter((item: any) => item.id !== 4);
        setItemTypes(visibleItemTypes || []);

        // Choose first visible item type (exclude id === 4)
        const firstVisibleItemType = visibleItemTypes.length > 0 ? visibleItemTypes[0].id : (itemTypesRes.length > 0 ? itemTypesRes[0].id : null);

        // Set default values for dropdowns
        setFormData((prev) => ({
          ...prev,
          itemTaxType: filteredTaxTypes.length > 0 ? String(filteredTaxTypes[0].id) : "",
          itemType: firstVisibleItemType ? String(firstVisibleItemType) : "",
          unitOfMeasure: filteredUnits.length > 0 ? String(filteredUnits[0].id) : "",
          salesAccount: resolveAccountCode(chartMastersRes || [], "", ["4010", "2000"]),
          inventoryAccount: resolveAccountCode(chartMastersRes || [], "", ["1510", "1100"]),
          cogsAccount: resolveCogsAccountCode(chartMastersRes || [], ""),
          inventoryAdjustmentAccount: resolveAccountCode(chartMastersRes || [], "", ["5040", "2214"]),
          itemAssemblyCostAccount: resolveAccountCode(chartMastersRes || [], "", ["2200", "1530"]),
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
    if (!formData.itemType) newErrors.itemType = "Select Item Type";
    if (!formData.unitOfMeasure) newErrors.unitOfMeasure = "Select Unit of Measure";
    if (!formData.salesAccount) newErrors.salesAccount = "Select Sales Account";
    if (!formData.inventoryAccount) newErrors.inventoryAccount = "Select Inventory Account";
    if (!formData.cogsAccount) newErrors.cogsAccount = "Select C.O.G.S. Account";
    if (!formData.inventoryAdjustmentAccount)
      newErrors.inventoryAdjustmentAccount = "Select Inventory Adjustment Account";
    if (!formData.itemAssemblyCostAccount)
      newErrors.itemAssemblyCostAccount = "Select Item Assembly Cost Account";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      description: formData.categoryName,
      dflt_tax_type: parseInt(formData.itemTaxType),
      dflt_mb_flag: parseInt(formData.itemType),
      dflt_units: parseInt(formData.unitOfMeasure),
      dflt_sales_act: formData.salesAccount,
      dflt_inventory_act: formData.inventoryAccount,
      dflt_cogs_act: formData.cogsAccount,
      dflt_adjustment_act: formData.inventoryAdjustmentAccount,
      dflt_wip_act: formData.itemAssemblyCostAccount,
      dflt_dim1: null,
      dflt_dim2: null,
      inactive: 0,
      dflt_no_sale: formData.excludeFromSales ? 1 : 0,
      dflt_no_purchase: formData.excludeFromPurchases ? 1 : 0,
    };

    try {
      const res = await createItemCategory(payload, chartMasters);
      // alert("Item Category added successfully!");
      setOpen(true);
      console.log("Created:", res);
      queryClient.invalidateQueries({ queryKey: ["itemCategories"], exact: false });
      //navigate("/itemsandinventory/maintenance/item-categories");
    } catch (err) {
      console.error("Failed to create item category:", err);
      setErrorMessage(getFriendlyApiErrorMessage(err));
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
          Add Item Category
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

          <FormControl size="small" fullWidth error={!!errors.itemType}>
            <InputLabel>Item Type</InputLabel>
            <Select
              name="itemType"
              value={formData.itemType}
              onChange={handleSelectChange}
              label="Item Type"
            >
              {itemTypes.map((type) => (
                <MenuItem key={type.id} value={String(type.id)}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.itemType || " "}</FormHelperText>
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
                checked={formData.excludeFromSales}
                onChange={handleCheckboxChange}
                name="excludeFromSales"
              />
            }
            label="Exclude from Sales"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.excludeFromPurchases}
                onChange={handleCheckboxChange}
                name="excludeFromPurchases"
              />
            }
            label="Exclude from Purchases"
          />

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

          {!isService && (
            <FormControl size="small" fullWidth error={!!errors.inventoryAccount}>
              <InputLabel>Inventory Account</InputLabel>
              <Select
                name="inventoryAccount"
                value={formData.inventoryAccount}
                onChange={handleSelectChange}
                label="Inventory Account"
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
          )}

          <FormControl size="small" fullWidth error={!!errors.cogsAccount}>
            <InputLabel>C.O.G.S. Account</InputLabel>
            <Select
              name="cogsAccount"
              value={formData.cogsAccount}
              onChange={handleSelectChange}
              label="C.O.G.S. Account"
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

          {!isService && (
            <FormControl size="small" fullWidth error={!!errors.inventoryAdjustmentAccount}>
              <InputLabel>Inventory Adjustment Account</InputLabel>
              <Select
                name="inventoryAdjustmentAccount"
                value={formData.inventoryAdjustmentAccount}
                onChange={handleSelectChange}
                label="Inventory Adjustment Account"
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
          )}

          {!isPurchase && !isService && (
            <FormControl size="small" fullWidth error={!!errors.itemAssemblyCostAccount}>
              <InputLabel>Item Assembly Cost Account</InputLabel>
              <Select
                name="itemAssemblyCostAccount"
                value={formData.itemAssemblyCostAccount}
                onChange={handleSelectChange}
                label="Item Assembly Cost Account"
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
              <FormHelperText>{errors.itemAssemblyCostAccount || " "}</FormHelperText>
            </FormControl>
          )}
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
            Add Item Category
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="New item category has been added!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => navigate("/itemsandinventory/maintenance/item-categories")}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}