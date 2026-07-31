import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
import DatePickerComponent from "../../../../../components/DatePickerComponent";
import { getChartMasters } from "../../../../../api/GLAccounts/ChartMasterApi";
import { getItemUnits } from "../../../../../api/ItemUnit/ItemUnitApi";
import { getItemTaxTypes } from "../../../../../api/ItemTaxType/ItemTaxTypeApi";
import { getItemCategories } from "../../../../../api/ItemCategories/ItemCategoriesApi";
import { getStockFaClasses } from "../../../../../api/StockFaClass/StockFaClassesApi";
import { getDepreciationMethods } from "../../../../../api/DepreciationMethod/DepreciationMethodApi";
import { getItemById, updateItem, deleteItem } from "../../../../../api/Item/ItemApi";
import { useNavigate, useParams } from "react-router-dom";
import { getItemTypes } from "../../../../../api/ItemType/ItemType";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../../components/ErrorModal";
import FormattedNumberField from "../../../../../components/FormattedNumberField";
import { useAuth } from "../../../../../context/AuthContext";

interface ItemGeneralSettingProps {
  itemId: string | number; //  always required now
}

export default function UpdateFixedAssetsGeneralSettingsForm({ itemId }: ItemGeneralSettingProps) {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fixed Asset items add/edit');
  const [formData, setFormData] = useState({
    itemCode: "",
    itemName: "",
    description: "",
    category: "",
    itemTaxType: "",
    unitOfMeasure: "",
    fixedAssetClass: "",
    depreciationMethod: "",
    baseRate: "",
    depreciationYears: "",
    rateMultiplier: "",
    depreciationStart: null as Date | null,
    costCenter: "",
    salesAccount: "",
    assetAccount: "",
    depreciationCostAccount: "",
    depreciationDisposalAccount: "",
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
    12: "General and Adminitrative Expenses",
  };

  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [chartMasters, setChartMasters] = useState<any[]>([]);
  const [itemTaxTypes, setItemTaxTypes] = useState<any[]>([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<any[]>([]);
  const [itemCategories, setItemCategories] = useState<any[]>([]);
  const [faClasses, setFaClasses] = useState<any[]>([]);
  const [depreciationMethods, setDepreciationMethods] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const queryClient = useQueryClient();

  // 🔹 preload existing item
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [chartMastersRes, taxTypesRes, unitsRes, itemCategoriesRes, faClassesRes, depreciationMethodsRes] = await Promise.all([
          getChartMasters(),
          getItemTaxTypes(),
          getItemUnits(),
          getItemCategories(),
          getStockFaClasses(),
          getDepreciationMethods(),
        ]);

        const filteredTaxTypes = (taxTypesRes || []).filter((type) => !type.inactive);
        const filteredUnits = (unitsRes || []).filter((unit) => !unit.inactive);
        const filteredItemCategories = (itemCategoriesRes || []).filter((cat) => !cat.inactive).filter((cat) => Number(cat.dflt_mb_flag) === 4);

        setChartMasters(chartMastersRes || []);
        setItemTaxTypes(filteredTaxTypes);
        setUnitsOfMeasure(filteredUnits);
        setItemCategories(filteredItemCategories);

        // fixed asset classes
        try {
          setFaClasses((faClassesRes || []).filter((c: any) => !c.inactive));
        } catch (err) {
          console.error("Failed to set FA classes:", err);
        }

        const depMethods = (typeof depreciationMethodsRes !== "undefined") ? (depreciationMethodsRes && (depreciationMethodsRes.data ?? depreciationMethodsRes)) : [];
        setDepreciationMethods(depMethods || []);

        // Set default values for dropdowns
        setFormData((prev) => ({
          ...prev,
          // use category_id (API uses this key) for defaults
          category: filteredItemCategories.length > 0 ? String(filteredItemCategories[0].category_id ?? filteredItemCategories[0].id) : "",
          itemTaxType: filteredTaxTypes.length > 0 ? String(filteredTaxTypes[0].id) : "",
          unitOfMeasure: filteredUnits.length > 0 ? String(filteredUnits[0].id) : "",
          salesAccount: chartMastersRes.find((acc) => acc.account_code === "4010")?.account_code || "",
          assetAccount: chartMastersRes.find((acc) => acc.account_code === "1510")?.account_code || "",
          depreciationCostAccount: chartMastersRes.find((acc) => acc.account_code === "5010")?.account_code || "",
          depreciationDisposalAccount: chartMastersRes.find((acc) => acc.account_code === "5040")?.account_code || "",
        }));
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    fetchData();
  }, []);

  // fetch the specific item by id and populate form
  const {
    data: itemData,
    isLoading: itemLoading,
    isError: itemError,
    error: itemFetchError,
  } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItemById(itemId),
    enabled: !!itemId,
  });

  // map fetched itemData into form state
  useEffect(() => {
    if (!itemData) return;
    const data = itemData as any;
    setFormData((prev) => ({
      ...prev,
      itemCode: data.stock_id ?? "",
      itemName: data.description ?? "",
      description: data.long_description ?? "",
      category: data.category_id ? String(data.category_id) : prev.category || "",
      itemTaxType: data.tax_type_id ? String(data.tax_type_id) : prev.itemTaxType || "",
      unitOfMeasure: data.units ? String(data.units) : prev.unitOfMeasure || "",
      fixedAssetClass: data.fa_class_id ? String(data.fa_class_id) : (prev.fixedAssetClass || ""),
      depreciationMethod: data.depreciation_method ? String(data.depreciation_method) : (prev.depreciationMethod || ""),
      baseRate: data.depreciation_rate ? String(data.depreciation_rate) : "",
      // Depreciation years may be stored in `depreciation_years` or (legacy) in `depreciation_rate` for type N
      depreciationYears: data.depreciation_years ? String(data.depreciation_years) : (data.depreciationYears ? String(data.depreciationYears) : (data.depreciation_rate ? String(data.depreciation_rate) : "")),
      rateMultiplier: data.depreciation_factor ? String(data.depreciation_factor) : "",
      depreciationStart: data.depreciation_start ? new Date(data.depreciation_start) : null,
      costCenter: "", // assuming not in API yet
      salesAccount: data.sales_account ?? prev.salesAccount ?? "",
      assetAccount: data.inventory_account ?? prev.assetAccount ?? "",
      depreciationCostAccount: data.cogs_account ?? prev.depreciationCostAccount ?? "",
      depreciationDisposalAccount: data.adjustment_account ?? prev.depreciationDisposalAccount ?? "",
      itemStatus: data.inactive ? "Inactive" : "Active",
    }));
  }, [itemData]);

  // When fixedAssetClass or depreciation method changes, update Base Rate from selected FA class depreciation_rate
  useEffect(() => {
    if (!formData.fixedAssetClass) return;
    if (!isSOrDMethod(formData.depreciationMethod)) return;
    if (isOtherMethod(formData.depreciationMethod)) return;
    const selected = faClasses.find((f: any) => String(f.fa_class_id) === String(formData.fixedAssetClass));
    if (selected && selected.depreciation_rate !== undefined && selected.depreciation_rate !== null) {
      setFormData(prev => ({ ...prev, baseRate: String(selected.depreciation_rate) }));
    }
  }, [formData.fixedAssetClass, faClasses, formData.depreciationMethod, depreciationMethods]);

  // Clear rateMultiplier when depreciation method is Straight Line (S) or Other (O)
  useEffect(() => {
    if ((isStraightLineMethod(formData.depreciationMethod) || isOtherMethod(formData.depreciationMethod)) && formData.rateMultiplier) {
      setFormData(prev => ({ ...prev, rateMultiplier: "" }));
    }
  }, [formData.depreciationMethod, depreciationMethods]);

  // When method type = 'N' (Sum of Years' Digits), hide/clear baseRate + rateMultiplier (legacy years stored in depreciation_rate)
  useEffect(() => {
    if (isNoneMethod(formData.depreciationMethod)) {
      // clear baseRate and rateMultiplier
      setFormData(prev => ({ ...prev, baseRate: "", rateMultiplier: prev.rateMultiplier ? "" : "" }));
    }
  }, [formData.depreciationMethod]);

  // When method type = 'O' (Other), force Depreciation Rate (baseRate) to 100 and disable editing
  useEffect(() => {
    if (isOtherMethod(formData.depreciationMethod)) {
      if (formData.baseRate !== "100") setFormData(prev => ({ ...prev, baseRate: "100" }));
    }
  }, [formData.depreciationMethod, depreciationMethods]);

  // mutation to update item
  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateItem(itemId, payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["items"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["item", itemId], exact: true });
      //alert("Fixed Asset updated successfully!");
      setOpen(true);
    },
    onError: (err: any) => {
      console.error("Failed to update fixed asset:", err);
      const message = err?.response?.data?.message || err?.message || "Failed to update fixed asset";
      if (err?.response?.data?.errors) {
        const details = Object.entries(err.response.data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : v}`).join('\n');
        // alert(`${message}\n${details}`);
        setErrorOpen(true);
      } else {
        alert(message);
      }
    },
  });

  const handleChange = (field: string, value: string | boolean | File | Date | null) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  // Helper methods copied from FixedAssetsGeneralSettingsForm
  const isStraightLineMethod = (methodId?: string | number) => {
    if (!methodId) return false;
    const idStr = String(methodId).toLowerCase();
    if (idStr === "straight-line" || idStr === "s" || idStr === "straight") return true;
    const m = depreciationMethods.find((dm: any) => {
      const key = String(dm.id ?? dm.depreciation_method_id ?? dm.method_id ?? dm.code ?? dm.description ?? "").toLowerCase();
      return key === idStr;
    });
    if (!m) return false;
    const code = String(m.code ?? m.type ?? m.method_code ?? "").toLowerCase();
    const desc = String(m.description ?? m.name ?? "").toLowerCase();
    return code === "s" || desc.includes("straight");
  };

  const isOtherMethod = (methodId?: string | number) => {
    if (!methodId) return false;
    const idStr = String(methodId).toLowerCase();
    if (idStr === "o" || idStr === "other") return true;
    const m = depreciationMethods.find((dm: any) => {
      const key = String(dm.id ?? dm.depreciation_method_id ?? dm.method_id ?? dm.code ?? dm.description ?? "").toLowerCase();
      return key === idStr;
    });
    if (!m) return false;
    const code = String(m.code ?? m.type ?? m.method_code ?? "").toLowerCase();
    const desc = String(m.description ?? m.name ?? "").toLowerCase();
    return code === "o" || desc.includes("other") || desc.includes("one-time");
  };

  const isDecliningMethod = (methodId?: string | number) => {
    if (!methodId) return false;
    const idStr = String(methodId).toLowerCase();
    if (idStr === "d" || idStr === "declining" || idStr.includes("declin")) return true;
    const m = depreciationMethods.find((dm: any) => {
      const key = String(dm.id ?? dm.depreciation_method_id ?? dm.method_id ?? dm.code ?? dm.description ?? "").toLowerCase();
      return key === idStr;
    });
    if (!m) return false;
    const code = String(m.code ?? m.type ?? m.method_code ?? "").toLowerCase();
    const desc = String(m.description ?? m.name ?? "").toLowerCase();
    return code === "d" || desc.includes("declin") || desc.includes("declining");
  };

  const isSOrDMethod = (methodId?: string | number) => {
    return isStraightLineMethod(methodId) || isDecliningMethod(methodId);
  };

  const isNoneMethod = (methodId?: string | number) => {
    if (!methodId) return false;
    const idStr = String(methodId).toLowerCase();
    if (idStr === "n" || idStr === "sum-of-years" || idStr === "sum" || idStr.includes("sum") || (idStr.includes("year") && idStr.includes("digit"))) return true;
    const m = depreciationMethods.find((dm: any) => {
      const key = String(dm.id ?? dm.depreciation_method_id ?? dm.method_id ?? dm.code ?? dm.description ?? "").toLowerCase();
      return key === idStr;
    });
    if (!m) return false;
    const code = String(m.code ?? m.type ?? m.method_code ?? "").toLowerCase();
    const desc = String(m.description ?? m.name ?? "").toLowerCase();
    return code === "n" || desc.includes("sum") || (desc.includes("year") && desc.includes("digit"));
  };

  const validate = () => {
    const tempErrors: { [key: string]: string } = {};
    if (!formData.itemCode) tempErrors.itemCode = "Item Code is required";
    if (!formData.itemName) tempErrors.itemName = "Item Name is required";
    if (!formData.description) tempErrors.description = "Description is required";
    if (!formData.category) tempErrors.category = "Category is required";
    if (!formData.itemTaxType) tempErrors.itemTaxType = "Item Tax Type is required";
    if (!formData.unitOfMeasure) tempErrors.unitOfMeasure = "Unit of Measure is required";
    if (!formData.salesAccount) tempErrors.salesAccount = "Sales Account is required";
    if (!formData.assetAccount) tempErrors.assetAccount = "Asset Account is required";
    if (!formData.depreciationCostAccount) tempErrors.depreciationCostAccount = "Depreciation Cost Account is required";
    if (!formData.depreciationDisposalAccount) tempErrors.depreciationDisposalAccount = "Depreciation/Disposal Account is required";

    // If depreciation method type = 'N', require Depreciation Years and block base/rate fields
    if (isNoneMethod(formData.depreciationMethod)) {
      if (!formData.depreciationYears) tempErrors.depreciationYears = "Depreciation Years is required for this method";
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleUpdate = () => {
    if (!validate()) return;
    const payload = {
      stock_id: formData.itemCode,
      category_id: parseInt(formData.category),
      tax_type_id: parseInt(formData.itemTaxType),
      description: formData.itemName,
      long_description: formData.description,
      units: parseInt(formData.unitOfMeasure),
      mb_flag: 4,
      sales_account: formData.salesAccount,
      inventory_account: formData.assetAccount,
      cogs_account: formData.depreciationCostAccount,
      adjustment_account: formData.depreciationDisposalAccount,
      wip_account: '1530',
      inactive: formData.itemStatus === "Inactive" ? 1 : 0,
      purchase_cost: 0,
      material_cost: 0,
      labour_cost: 0,
      overhead_cost: 0,
      depreciation_method: formData.depreciationMethod,
      // For method N (Sum-of-years digits) years are stored in `depreciation_rate` (legacy).
      depreciation_rate: isNoneMethod(formData.depreciationMethod)
        ? (parseFloat(formData.depreciationYears) || 0)
        : (parseFloat(formData.baseRate) || 0),
      depreciation_factor: parseFloat(formData.rateMultiplier) || 0,
      depreciation_start: formData.depreciationStart ? formData.depreciationStart.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      // ensure depreciation_date >= depreciation_start
      depreciation_date: formData.depreciationStart ? formData.depreciationStart.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      fa_class_id: formData.fixedAssetClass,
      imageFile: formData.imageFile
    };
    updateMutation.mutate(payload);
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleClone = () => {
    const cloned = { ...formData, itemCode: formData.itemCode + "-CLONE" };
    console.log("Cloned Fixed Asset:", cloned);
    alert("Fixed Asset cloned! Please edit before saving.");
    setFormData(cloned);
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"], exact: false });
      alert("Fixed Asset deleted successfully!");
    },
    onError: (err: any) => {
      console.error("Failed to delete fixed asset:", err);
      const message = err?.response?.data?.message || err?.message || "Failed to delete fixed asset!";
      if (err?.response?.data?.errors) {
        const details = Object.entries(err.response.data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : v}`).join('\n');
        alert(`${message}\n${details}`);
      } else {
        alert(message);
      }
    },
  });

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this fixed asset?")) {
      deleteMutation.mutate();
    }
  };

  // show loading / error for fetch-item
  if (itemLoading) {
    return (
      <Stack alignItems="center" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography>Loading item...</Typography>
      </Stack>
    );
  }
  if (itemError) {
    return (
      <Stack alignItems="center" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography color="error">Failed to load item</Typography>
      </Stack>
    );
  }
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
          Update Fixed Asset
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
                size="small"
                fullWidth
                error={!!errors.itemCode}
                helperText={errors.itemCode}
                // Make item code non-editable but selectable (readOnly).
                InputProps={{ readOnly: true }}
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
                <FormHelperText>{errors.itemTaxType}</FormHelperText>
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

              <Typography variant="subtitle1" sx={{ mt: 2 }}>Depreciation</Typography>
              <Divider />

              <FormControl size="small" fullWidth>
                <InputLabel>Fixed Asset Class</InputLabel>
                <Select
                  name="fixedAssetClass"
                  value={formData.fixedAssetClass}
                  onChange={handleSelectChange}
                  label="Fixed Asset Class"
                >
                  {faClasses.map((f: any) => (
                    <MenuItem key={f.fa_class_id} value={String(f.fa_class_id)}>
                      {f.fa_class_id} - {f.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Depreciation Method</InputLabel>
                <Select
                  name="depreciationMethod"
                  value={formData.depreciationMethod}
                  onChange={handleSelectChange}
                  label="Depreciation Method"
                >
                  {depreciationMethods && depreciationMethods.length > 0 ? (
                    depreciationMethods.map((m: any) => {
                      const id = m.id ?? m.depreciation_method_id ?? m.method_id;
                      const label = m.description ?? m.name ?? m.method ?? String(id);
                      const value = String(id ?? label);
                      return (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      );
                    })
                  ) : (
                    <>
                      <MenuItem value="straight-line">Straight Line</MenuItem>
                      <MenuItem value="declining-balance">Declining Balance</MenuItem>
                      <MenuItem value="units-of-production">Units of Production</MenuItem>
                    </>
                  )}
                </Select>
              </FormControl>

              {!isNoneMethod(formData.depreciationMethod) && (
                <FormattedNumberField
                  label={(isOtherMethod(formData.depreciationMethod) || isStraightLineMethod(formData.depreciationMethod)) ? "Depreciation Rate" : "Base Rate"}
                  value={formData.baseRate}
                  onChange={(e) => handleChange("baseRate", e.target.value)}
                  size="small"
                  fullWidth
                  disabled={isOtherMethod(formData.depreciationMethod)}
                />
              )}

              {!(isStraightLineMethod(formData.depreciationMethod) || isOtherMethod(formData.depreciationMethod) || isNoneMethod(formData.depreciationMethod)) && (
                <FormattedNumberField
                  label="Rate Multiplier"
                  value={formData.rateMultiplier}
                  onChange={(e) => handleChange("rateMultiplier", e.target.value)}
                  size="small"
                  fullWidth
                />
              )}

              <DatePickerComponent
                label="Depreciation Start"
                value={formData.depreciationStart}
                onChange={(date) => handleChange("depreciationStart", date)}
              />

              {isNoneMethod(formData.depreciationMethod) && (
                <FormattedNumberField
                  label="Depreciation Years"
                  value={formData.depreciationYears}
                  onChange={(e) => handleChange("depreciationYears", e.target.value)}
                  size="small"
                  fullWidth
                />
              )}



              <Typography variant="subtitle1" sx={{ mt: 2 }}>Cost Center</Typography>
              <Divider />

              <FormControl size="small" fullWidth>
                <InputLabel>Cost Center</InputLabel>
                <Select
                  name="costCenter"
                  value={formData.costCenter}
                  onChange={handleSelectChange}
                  label="Cost Center"
                >
                  <MenuItem value="costCenter1">CostCenter 1</MenuItem>
                  <MenuItem value="costCenter2">CostCenter 2</MenuItem>
                  <MenuItem value="costCenter3">CostCenter 3</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Grid>

          {/* GL Accounts */}
          <Grid item xs={12} md={6}>
            <Stack spacing={4}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">GL Account</Typography>
                <Divider />
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

                <FormControl size="small" fullWidth error={!!errors.assetAccount}>
                  <InputLabel>Asset Account</InputLabel>
                  <Select
                    name="assetAccount"
                    value={formData.assetAccount}
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
                  <FormHelperText>{errors.assetAccount || " "}</FormHelperText>
                </FormControl>

                <FormControl size="small" fullWidth error={!!errors.depreciationCostAccount}>
                  <InputLabel>Depreciation Cost Account</InputLabel>
                  <Select
                    name="depreciationCostAccount"
                    value={formData.depreciationCostAccount}
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
                  <FormHelperText>{errors.depreciationCostAccount || " "}</FormHelperText>
                </FormControl>

                <FormControl size="small" fullWidth error={!!errors.depreciationDisposalAccount}>
                  <InputLabel>Depreciation/Disposal Account</InputLabel>
                  <Select
                    name="depreciationDisposalAccount"
                    value={formData.depreciationDisposalAccount}
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
                  <FormHelperText>{errors.depreciationDisposalAccount || " "}</FormHelperText>
                </FormControl>


              </Stack>


              {/* Other */}

              <Stack spacing={2}>
                <Typography variant="subtitle1">Other</Typography>
                <Divider />
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

              {/* Values */}
              <Stack spacing={2}>
                <Typography variant="subtitle1">Values</Typography>
                <Divider />
                <Typography>Initial Value:</Typography>
                <Typography>Depreciations:</Typography>
                <Typography>Current Value:</Typography>
              </Stack>
            </Stack>
          </Grid>
        </Grid>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: theme.spacing(4),
            flexDirection: { xs: "column", sm: "row" },
            gap: theme.spacing(2),
          }}
        >
          <Button variant="outlined" sx={{ width: '140px' }} onClick={() => window.history.back()}>
            Back
          </Button>
          <Button variant="contained" color="primary" sx={{ width: '140px' }} onClick={handleUpdate}>
            Update Fixed Asset
          </Button>
          <Button variant="contained" color="secondary" sx={{ width: '140px' }} onClick={handleClone}>
            Clone Fixed Asset
          </Button>
          <Button disabled={!canEdit} variant="outlined" color="error" sx={{ width: '140px' }} onClick={handleDelete}>
            Delete Fixed Asset
          </Button>
        </Box>
      </Box>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Fixed Asset has been updated successfully!"
        handleClose={() => setOpen(false)}
        onSuccess={() => {
          // Form was already cleared on successful update
          setOpen(false);
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
