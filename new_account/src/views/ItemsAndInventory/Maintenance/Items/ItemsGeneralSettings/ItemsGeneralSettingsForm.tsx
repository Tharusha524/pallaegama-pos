import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
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
  Button,
  Divider,
  Checkbox,
  FormControlLabel,
  Grid,
  ListSubheader,
} from "@mui/material";
import theme from "../../../../../theme";
import { getItemTaxTypes } from "../../../../../api/ItemTaxType/ItemTaxTypeApi";
import { getChartMasters } from "../../../../../api/GLAccounts/ChartMasterApi";
import { getItemUnits } from "../../../../../api/ItemUnit/ItemUnitApi";
import { getItemTypes } from "../../../../../api/ItemType/ItemType";
import { getItemCategories } from "../../../../../api/ItemCategories/ItemCategoriesApi";
import { createItem } from "../../../../../api/Item/ItemApi";
import { getInventoryLocations } from "../../../../../api/InventoryLocation/InventoryLocationApi";
import { createLocStock } from "../../../../../api/LocStock/LocStockApi";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import ErrorModal from "../../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../../components/AddedConfirmationModal";
import { getFriendlyApiErrorMessage } from "../../../../../utils/apiErrorMessage";
import {
  glAccountsFromCategory,
  resolveItemGlAccounts,
} from "../../../../../utils/stockMasterDefaults";
import ProfileImage from "../../../../../components/ProfileImageComponent";
import { useAuth } from "../../../../../context/AuthContext";
interface ItemGeneralSettingProps {
  itemId?: string | number;
}

export default function ItemsGeneralSettingsForm({ itemId }: ItemGeneralSettingProps) {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Stock items add/edit');

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    itemCode: "",
    itemName: "",
    description: "",
    category: "",
    itemTaxType: "",
    itemType: "",
    unitOfMeasure: "",
    editableDescription: false,
    excludedFromSales: false,
    excludedFromPurchases: false,
    salesAccount: "",
    inventoryAccount: "",
    cogsAccount: "",
    wipAccount: "",
    inventoryAdjustmentAccount: "",
    imageFile: null as File | null,
    itemStatus: "",
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

  const [chartMasters, setChartMasters] = useState<any[]>([]);
  const [itemTaxTypes, setItemTaxTypes] = useState<any[]>([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<any[]>([]);
  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [itemCategories, setItemCategories] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const selectedItemType = itemTypes.find((t) => String(t.id) === formData.itemType);
  const isPurchase = selectedItemType?.name?.toLowerCase() === "purchased";
  const isService = selectedItemType?.name?.toLowerCase() === "service";

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [chartMastersRes, taxTypesRes, unitsRes, itemTypesRes, itemCategoriesRes] = await Promise.all([
          getChartMasters(),
          getItemTaxTypes(),
          getItemUnits(),
          getItemTypes(),
          getItemCategories(),
        ]);

        const filteredTaxTypes = (taxTypesRes || []).filter((type) => !type.inactive);
        const filteredUnits = (unitsRes || []).filter((unit) => !unit.inactive);
        const filteredItemTypes = (itemTypesRes || []).filter((type) => !type.inactive);
        const filteredItemCategories = (itemCategoriesRes || []).filter((cat) => !cat.inactive);

        setChartMasters(chartMastersRes || []);
        setItemTaxTypes(filteredTaxTypes);
        setUnitsOfMeasure(filteredUnits);
        setItemTypes(filteredItemTypes);
        setItemCategories(filteredItemCategories);

        const firstCategory = filteredItemCategories[0];
        const fromCategory = glAccountsFromCategory(firstCategory);
        const gl = resolveItemGlAccounts(
          {
            salesAccount: fromCategory.salesAccount ?? "",
            inventoryAccount: fromCategory.inventoryAccount ?? "",
            cogsAccount: fromCategory.cogsAccount ?? "",
            inventoryAdjustmentAccount: fromCategory.inventoryAdjustmentAccount ?? "",
            wipAccount: fromCategory.wipAccount ?? "",
          },
          chartMastersRes || [],
          firstCategory
        );

        setFormData((prev) => ({
          ...prev,
          category: firstCategory
            ? String(firstCategory.category_id ?? firstCategory.id)
            : "",
          itemTaxType:
            fromCategory.itemTaxType ||
            (filteredTaxTypes.length > 0 ? String(filteredTaxTypes[0].id) : ""),
          itemType:
            fromCategory.itemType ||
            (filteredItemTypes.find((type) => type.id === 2)
              ? String(2)
              : filteredItemTypes.length > 0
                ? String(filteredItemTypes[0].id)
                : ""),
          unitOfMeasure:
            fromCategory.unitOfMeasure ||
            (filteredUnits.length > 0 ? String(filteredUnits[0].id) : ""),
          ...gl,
        }));
      } catch (err) {
        console.error("Failed to fetch data:", err);
         setErrorMessage("Failed to fetch data");
         setErrorOpen(true);
      }
    };
    fetchData();
  }, []);

  const handleChange = (field: string, value: string | boolean | File | null) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" }); // clear error
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    if (name === "category") {
      const category = itemCategories.find(
        (cat) => String(cat.category_id ?? cat.id) === String(value)
      );
      const fromCategory = glAccountsFromCategory(category);
      const gl = resolveItemGlAccounts(
        {
          salesAccount: fromCategory.salesAccount || formData.salesAccount,
          inventoryAccount: fromCategory.inventoryAccount || formData.inventoryAccount,
          cogsAccount: fromCategory.cogsAccount || formData.cogsAccount,
          inventoryAdjustmentAccount:
            fromCategory.inventoryAdjustmentAccount || formData.inventoryAdjustmentAccount,
          wipAccount: fromCategory.wipAccount || formData.wipAccount,
        },
        chartMasters,
        category
      );
      setFormData({
        ...formData,
        category: value,
        itemTaxType: fromCategory.itemTaxType || formData.itemTaxType,
        itemType: fromCategory.itemType || formData.itemType,
        unitOfMeasure: fromCategory.unitOfMeasure || formData.unitOfMeasure,
        ...gl,
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const tempErrors: { [key: string]: string } = {};

    if (!formData.itemCode) tempErrors.itemCode = "Item Code is required";
    if (!formData.itemName) tempErrors.itemName = "Item Name is required";
    if (!formData.description) tempErrors.description = "Description is required";
    if (!formData.category) tempErrors.category = "Category is required";
    if (!formData.itemType) tempErrors.itemType = "Item Type is required";
    if (!formData.unitOfMeasure) tempErrors.unitOfMeasure = "Unit of Measure is required";
    if (!formData.salesAccount) tempErrors.salesAccount = "Sales Account is required";
    if (!formData.inventoryAccount) tempErrors.inventoryAccount = "Inventory Account is required";
    if (!formData.cogsAccount) tempErrors.cogsAccount = "C.O.G.S. Account is required";
    if (!formData.inventoryAdjustmentAccount) tempErrors.inventoryAdjustmentAccount = "Inventory Adjustment Account is required";
    if (!formData.wipAccount) tempErrors.wipAccount = "WIP Account is required";

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const category = itemCategories.find(
      (cat) => String(cat.category_id ?? cat.id) === formData.category
    );
    const gl = resolveItemGlAccounts(
      {
        salesAccount: formData.salesAccount,
        inventoryAccount: formData.inventoryAccount,
        cogsAccount: formData.cogsAccount,
        inventoryAdjustmentAccount: formData.inventoryAdjustmentAccount,
        wipAccount: formData.wipAccount,
      },
      chartMasters,
      category
    );

    const payload = {
      stock_id: formData.itemCode, // required
      category_id: parseInt(formData.category),
      tax_type_id: formData.itemTaxType ? parseInt(formData.itemTaxType) : null,
      description: formData.itemName,
      long_description: formData.description,
      units: parseInt(formData.unitOfMeasure),
      mb_flag: parseInt(formData.itemType),
      sales_account: gl.salesAccount,
      inventory_account: gl.inventoryAccount,
      cogs_account: gl.cogsAccount,
      adjustment_account: gl.inventoryAdjustmentAccount,
      wip_account: gl.wipAccount,
      editable: formData.editableDescription ? 1 : 0,
      inactive: formData.itemStatus === "Inactive" ? 1 : 0,
      no_sale: formData.excludedFromSales ? 1 : 0,
      no_purchase: formData.excludedFromPurchases ? 1 : 0,
      purchase_cost: 0,
      material_cost: 0,
      labour_cost: 0,
      overhead_cost: 0,
      depreciation_method: null,
      depreciation_rate: 0,
      depreciation_factor: 0,
      depreciation_start: "2020-10-10",
      depreciation_date: "2020-10-10",
      fa_class_id: null,
      imageFile: formData.imageFile
    };


    try {
      const res = await createItem(payload, { chartMasters, category }); // your API call
      const newStockId = formData.itemCode;

      // Fetch inventory locations and create loc_stock records
      const locations = await getInventoryLocations();
      const locStockPromises = locations.map(location =>
        createLocStock({
          loc_code: location.loc_code,
          stock_id: newStockId,
          reorder_level: 0,
        })
      );
      await Promise.all(locStockPromises);

//      alert("Item added successfully!");
      setOpen(true);
      console.log("Created:", res);
      queryClient.invalidateQueries({ queryKey: ["items"], exact: false });

      setFormData((prev) => ({
        ...prev,
        itemCode: "",
        itemName: "",
        description: "",
        imageFile: null,
      }));

      navigate("/itemsandinventory/maintenance/items");
    } catch (err) {
      console.error("Failed to create item:", err);
      setErrorMessage(getFriendlyApiErrorMessage(err));
      setErrorOpen(true);
    }
  };


  return (
    <FormPageLayout>
      <Box
        sx={{
          width: "100%",
          maxWidth: "1200px",
          p: theme.spacing(3),
          boxShadow: theme.shadows[2],
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Typography variant="h5" sx={{ mb: theme.spacing(3), textAlign: "center" }}>
          Item Setup
        </Typography>

        <Grid container spacing={4}>
          {/* General Settings */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">General</Typography>
              <Divider />
              <TextField
                label="Item Code"
                value={formData.itemCode}
                onChange={(e) => handleChange("itemCode", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.itemCode}
                helperText={errors.itemCode}
              />
              <TextField
                label="Name"
                value={formData.itemName}
                onChange={(e) => handleChange("itemName", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.itemName}
                helperText={errors.itemName}
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.description}
                helperText={errors.description}
              />

              <FormControl size="small" fullWidth error={!!errors.category}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  name="category"
                  onChange={handleSelectChange} // same as other dropdowns
                >
                  {itemCategories.map((cat) => (
                    <MenuItem key={cat.category_id} value={String(cat.category_id ?? cat.id)}>
                      {cat.description}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.category}</FormHelperText>
              </FormControl>

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
                <FormHelperText>{errors.itemType}</FormHelperText>
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
                <FormHelperText>{errors.unitOfMeasure}</FormHelperText>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.editableDescription}
                    onChange={(e) => handleChange("editableDescription", e.target.checked)}
                  />
                }
                label="Editable Description"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.excludedFromSales}
                    onChange={(e) => handleChange("excludedFromSales", e.target.checked)}
                  />
                }
                label="Excluded from Sales"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.excludedFromPurchases}
                    onChange={(e) => handleChange("excludedFromPurchases", e.target.checked)}
                  />
                }
                label="Excluded from Purchases"
              />
            </Stack>
          </Grid>

          {/* GL Accounts */}
          <Grid item xs={12} md={6}>
            <Stack spacing={4}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">GL Account</Typography>
                <Divider />
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
                                {acc.account_code}- {acc.account_name}
                              </Stack>
                            </MenuItem>
                          )),
                        ];
                      });
                    })()}
                  </Select>
                  <FormHelperText>{errors.salesAccount}</FormHelperText>
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

                <FormControl size="small" fullWidth error={!!errors.wipAccount}>
                    <InputLabel>WIP / Assembly Account</InputLabel>
                    <Select
                      name="wipAccount"
                      value={formData.wipAccount}
                      onChange={handleSelectChange}
                      label="WIP / Assembly Account"
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
                    <FormHelperText>
                      {errors.wipAccount || "Required — defaults from item category (dflt_wip_act)"}
                    </FormHelperText>
                  </FormControl>
              </Stack>


              {/* Other */}

              <Stack spacing={2}>
                <Typography variant="subtitle1">Other</Typography>
                <Divider />
                <Stack direction="row" spacing={2} alignItems="center">
                  <ProfileImage
                    name={formData.itemName}
                    files={formData.imageFile ? [formData.imageFile] : undefined}
                    size="4rem"
                  />
                  <Button
                    variant="outlined"
                    component="label"
                  >
                    Upload Image (.jpg)
                    <input
                      type="file"
                      hidden
                      accept=".jpg"
                      onChange={(e) => handleChange("imageFile", e.target.files ? e.target.files[0] : null)}
                    />
                  </Button>
                </Stack>
                <FormControl size="small" fullWidth>
                  <InputLabel>Item Status</InputLabel>
                  <Select
                    value={formData.itemStatus}
                    onChange={(e) => handleChange("itemStatus", e.target.value)}
                  >
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: theme.spacing(4),
            flexDirection: { xs: "column", sm: "row" },
            gap: theme.spacing(2),
          }}
        >
          <Button variant="outlined" onClick={() => window.history.back()}>
            Back
          </Button>
          <Button disabled={!canEdit}
            variant="contained"
            sx={{ backgroundColor: theme.palette.primary.main }}
            onClick={handleSubmit}
          >
            Insert New Item
          </Button>
        </Box>
      </Box>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Item has been added successfully!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
