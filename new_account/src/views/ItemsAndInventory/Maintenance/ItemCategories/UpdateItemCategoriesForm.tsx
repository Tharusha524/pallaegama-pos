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
import { getItemCategoryById, updateItemCategory } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { useNavigate, useParams } from "react-router-dom";
import { getItemTypes } from "../../../../api/ItemType/ItemType";
import { useQueryClient } from "@tanstack/react-query";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
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

export default function UpdateItemCategoriesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Item categories');

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
    12: "General and Adminitrative Expenses",
  };

  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [chartMasters, setChartMasters] = useState<any[]>([]);
  const [itemTaxTypes, setItemTaxTypes] = useState<any[]>([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Partial<ItemCategoriesFormData>>({});
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  // FIXED HERE: Proper number comparison
  const selectedItemType = itemTypes.find(
    (t) => Number(t.id) === Number(formData.itemType)
  );
  const isPurchase = selectedItemType?.name?.toLowerCase() === "purchased";
  const isService = selectedItemType?.name?.toLowerCase() === "service";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [chartMastersRes, taxTypesRes, unitsRes, categoryRes, itemTypesRes] =
          await Promise.all([
            getChartMasters(),
            getItemTaxTypes(),
            getItemUnits(),
            getItemCategoryById(Number(id)),
            getItemTypes(),
          ]);

        setChartMasters(chartMastersRes || []);
        setItemTaxTypes((taxTypesRes || []).filter((type) => !type.inactive));
        setUnitsOfMeasure((unitsRes || []).filter((unit) => !unit.inactive));
        setItemTypes(itemTypesRes || []);

        if (categoryRes) {
          setFormData({
            categoryName: categoryRes.description,
            itemTaxType: categoryRes.dflt_tax_type,
            itemType: categoryRes.dflt_mb_flag,
            unitOfMeasure: categoryRes.dflt_units,
            excludeFromSales: categoryRes.dflt_no_sale,
            excludeFromPurchases: categoryRes.dflt_no_purchase,
            salesAccount: categoryRes.dflt_sales_act,
            inventoryAccount: categoryRes.dflt_inventory_act,
            cogsAccount: categoryRes.dflt_cogs_act,
            inventoryAdjustmentAccount: categoryRes.dflt_adjustment_act,
            itemAssemblyCostAccount: categoryRes.dflt_wip_act,
          });
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setErrorMessage("Failed to load category data. Please try again.");
        setErrorOpen(true);
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

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
    if (!formData.inventoryAccount)
      newErrors.inventoryAccount = "Select Inventory Account";
    if (!formData.cogsAccount) newErrors.cogsAccount = "Select C.O.G.S. Account";
    if (!formData.inventoryAdjustmentAccount)
      newErrors.inventoryAdjustmentAccount =
        "Select Inventory Adjustment Account";
    if (!formData.itemAssemblyCostAccount)
      newErrors.itemAssemblyCostAccount = "Select Item Assembly Cost Account";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        const payload = {
          description: formData.categoryName,
          dflt_tax_type: parseInt(formData.itemTaxType, 10),
          dflt_mb_flag: parseInt(formData.itemType, 10),
          dflt_units: parseInt(formData.unitOfMeasure, 10),
          dflt_no_sale: formData.excludeFromSales ? 1 : 0,
          dflt_no_purchase: formData.excludeFromPurchases ? 1 : 0,
          dflt_sales_act: formData.salesAccount,
          dflt_inventory_act: formData.inventoryAccount,
          dflt_cogs_act: formData.cogsAccount,
          dflt_adjustment_act: formData.inventoryAdjustmentAccount,
          dflt_wip_act: formData.itemAssemblyCostAccount,
        };

        await updateItemCategory(Number(id), payload, chartMasters);
        queryClient.invalidateQueries({ queryKey: ["itemCategories"] });
       // alert("Item Category updated successfully!");
        setOpen(true);
      } catch (error: unknown) {
        console.error("Failed to update category:", error);
        const errData = (error as { data?: { errors?: Record<string, string[]> } })?.data;
        if (errData?.errors) {
          const backendErr = errData.errors;
          setErrors({
            categoryName: backendErr.description?.[0],
            itemTaxType: backendErr.dflt_tax_type?.[0],
            itemType: backendErr.dflt_mb_flag?.[0],
            unitOfMeasure: backendErr.dflt_units?.[0],
            salesAccount: backendErr.dflt_sales_act?.[0],
            inventoryAccount: backendErr.dflt_inventory_act?.[0],
            cogsAccount: backendErr.dflt_cogs_act?.[0],
            inventoryAdjustmentAccount: backendErr.dflt_adjustment_act?.[0],
            itemAssemblyCostAccount: backendErr.dflt_wip_act?.[0],
          });
          setErrorMessage("Validation errors occurred. Please check the fields.");
          setErrorOpen(true);
        } else {
          setErrorMessage(getFriendlyApiErrorMessage(error));
          setErrorOpen(true);
        }
      }
    }
  };

  return (
    <FormPageLayout>
      {isLoading ? (
        <Typography>Loading...</Typography>
      ) : (
        <Paper
          sx={{
            p: theme.spacing(3),
            maxWidth: "600px",
            width: "100%",
            boxShadow: 2,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
          >
            Update Item Category
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
                  <MenuItem key={type.id} value={type.id}>
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
                  <MenuItem key={type.id} value={type.id}>
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
                  <MenuItem key={unit.id} value={unit.id}>
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

            {/* Sales Account */}
            <FormControl size="small" fullWidth error={!!errors.salesAccount}>
              <InputLabel>Sales Account</InputLabel>
              <Select
                name="salesAccount"
                value={formData.salesAccount}
                onChange={handleSelectChange}
                label="Sales Account"
              >
                {Object.entries(
                  chartMasters.reduce((acc: any, item: any) => {
                    const type = item.account_type || "Unknown";
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(item);
                    return acc;
                  }, {})
                ).flatMap(([typeKey, accounts]: any) => {
                  const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                  return [
                    <ListSubheader key={`header-${typeKey}`}>
                      {typeText}
                    </ListSubheader>,
                    ...accounts.map((acc: any) => (
                      <MenuItem
                        key={acc.account_code}
                        value={acc.account_code}
                      >
                        {acc.account_code} - {acc.account_name}
                      </MenuItem>
                    )),
                  ];
                })}
              </Select>
              <FormHelperText>{errors.salesAccount || " "}</FormHelperText>
            </FormControl>

            {/* Inventory Account */}
            {!isService && (
              <FormControl
                size="small"
                fullWidth
                error={!!errors.inventoryAccount}
              >
                <InputLabel>Inventory Account</InputLabel>
                <Select
                  name="inventoryAccount"
                  value={formData.inventoryAccount}
                  onChange={handleSelectChange}
                  label="Inventory Account"
                >
                  {Object.entries(
                    chartMasters.reduce((acc: any, item: any) => {
                      const type = item.account_type || "Unknown";
                      if (!acc[type]) acc[type] = [];
                      acc[type].push(item);
                      return acc;
                    }, {})
                  ).flatMap(([typeKey, accounts]: any) => {
                    const typeText =
                      accountTypeMap[Number(typeKey)] || "Unknown";
                    return [
                      <ListSubheader key={`header-${typeKey}`}>
                        {typeText}
                      </ListSubheader>,
                      ...accounts.map((acc: any) => (
                        <MenuItem
                          key={acc.account_code}
                          value={acc.account_code}
                        >
                          {acc.account_code} - {acc.account_name}
                        </MenuItem>
                      )),
                    ];
                  })}
                </Select>
                <FormHelperText>
                  {errors.inventoryAccount || " "}
                </FormHelperText>
              </FormControl>
            )}

            {/* C.O.G.S Account */}
            <FormControl size="small" fullWidth error={!!errors.cogsAccount}>
              <InputLabel>C.O.G.S. Account</InputLabel>
              <Select
                name="cogsAccount"
                value={formData.cogsAccount}
                onChange={handleSelectChange}
                label="C.O.G.S. Account"
              >
                {Object.entries(
                  chartMasters.reduce((acc: any, item: any) => {
                    const type = item.account_type || "Unknown";
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(item);
                    return acc;
                  }, {})
                ).flatMap(([typeKey, accounts]: any) => {
                  const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                  return [
                    <ListSubheader key={`header-${typeKey}`}>
                      {typeText}
                    </ListSubheader>,
                    ...accounts.map((acc: any) => (
                      <MenuItem
                        key={acc.account_code}
                        value={acc.account_code}
                      >
                        {acc.account_code} - {acc.account_name}
                      </MenuItem>
                    )),
                  ];
                })}
              </Select>
              <FormHelperText>{errors.cogsAccount || " "}</FormHelperText>
            </FormControl>

            {/* Inventory Adjustment Account */}
            {!isService && (
              <FormControl
                size="small"
                fullWidth
                error={!!errors.inventoryAdjustmentAccount}
              >
                <InputLabel>Inventory Adjustment Account</InputLabel>
                <Select
                  name="inventoryAdjustmentAccount"
                  value={formData.inventoryAdjustmentAccount}
                  onChange={handleSelectChange}
                  label="Inventory Adjustment Account"
                >
                  {Object.entries(
                    chartMasters.reduce((acc: any, item: any) => {
                      const type = item.account_type || "Unknown";
                      if (!acc[type]) acc[type] = [];
                      acc[type].push(item);
                      return acc;
                    }, {})
                  ).flatMap(([typeKey, accounts]: any) => {
                    const typeText =
                      accountTypeMap[Number(typeKey)] || "Unknown";
                    return [
                      <ListSubheader key={`header-${typeKey}`}>
                        {typeText}
                      </ListSubheader>,
                      ...accounts.map((acc: any) => (
                        <MenuItem
                          key={acc.account_code}
                          value={acc.account_code}
                        >
                          {acc.account_code} - {acc.account_name}
                        </MenuItem>
                      )),
                    ];
                  })}
                </Select>
                <FormHelperText>
                  {errors.inventoryAdjustmentAccount || " "}
                </FormHelperText>
              </FormControl>
            )}

            {/* Item Assembly Cost Account */}
            {!isPurchase && !isService && (
              <FormControl
                size="small"
                fullWidth
                error={!!errors.itemAssemblyCostAccount}
              >
                <InputLabel>Item Assembly Cost Account</InputLabel>
                <Select
                  name="itemAssemblyCostAccount"
                  value={formData.itemAssemblyCostAccount}
                  onChange={handleSelectChange}
                  label="Item Assembly Cost Account"
                >
                  {Object.entries(
                    chartMasters.reduce((acc: any, item: any) => {
                      const type = item.account_type || "Unknown";
                      if (!acc[type]) acc[type] = [];
                      acc[type].push(item);
                      return acc;
                    }, {})
                  ).flatMap(([typeKey, accounts]: any) => {
                    const typeText =
                      accountTypeMap[Number(typeKey)] || "Unknown";
                    return [
                      <ListSubheader key={`header-${typeKey}`}>
                        {typeText}
                      </ListSubheader>,
                      ...accounts.map((acc: any) => (
                        <MenuItem
                          key={acc.account_code}
                          value={acc.account_code}
                        >
                          {acc.account_code} - {acc.account_name}
                        </MenuItem>
                      )),
                    ];
                  })}
                </Select>
                <FormHelperText>
                  {errors.itemAssemblyCostAccount || " "}
                </FormHelperText>
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
              onClick={handleSubmit}
            >
              Update Category
            </Button>
          </Box>
        </Paper>
      )}
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Selected item category has been updated!"
        handleClose={() => setOpen(false)}
        onSuccess={() => window.history.back()}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
