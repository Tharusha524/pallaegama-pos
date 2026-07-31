import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemCodes } from "../../../../api/ItemCodes/ItemCodesApi";
import { createItemCode } from "../../../../api/ItemCodes/ItemCodesApi";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { resolveStockId } from "../../../../utils/itemCodePayload";
import queryClient from "../../../../state/queryClient";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  useTheme,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListSubheader,
} from "@mui/material";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import theme from "../../../../theme";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface SalesKitFormData {
  selectedKit: string; // existing kit or "new"
  kitCode: string;
  component: string; // selected item name
  componentCode: string; // stock_id of selected item
  description: string;
  category: string;
  quantity: string;
}

const WHOLE_NUMBER = /^\d+$/;

// Mock existing sales kits for dropdown
// const mockSalesKits = [
//   { name: "Starter Kit", code: "KIT001" },
//   { name: "Pro Kit", code: "KIT002" },
//   { name: "Advanced Kit", code: "KIT003" },
// ];

// Mock items for Component dropdown
// const mockItems = [
//   { name: "Laptop", code: "ITM001" },
//   { name: "Toy Car", code: "ITM002" },
//   { name: "Notebook", code: "ITM003" },
//   { name: "Shirt", code: "ITM004" },
//   { name: "Food Pack", code: "ITM005" },
// ];

export default function AddSalesKitsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales kits');
  const [formData, setFormData] = useState<SalesKitFormData>({
    selectedKit: "new",
    kitCode: "",
    component: "",
    componentCode: "",
    description: "",
    category: "",
    quantity: "",
  });

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [errors, setErrors] = useState<Partial<SalesKitFormData>>({});
  const [selectedKitCode, setSelectedKitCode] = useState<string>("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [addComponentData, setAddComponentData] = useState<{ component: string | number; quantity: string }>({ component: "", quantity: "" });
  const [editComponentId, setEditComponentId] = useState<string | null>(null);
  const [addErrors, setAddErrors] = useState<Partial<typeof addComponentData>>({});
  const [editQuantityDialog, setEditQuantityDialog] = useState(false);
  const [editQuantityData, setEditQuantityData] = useState<{ id: string; quantity: string }>({ id: "", quantity: "" });

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const location = useLocation();
  const navigate = useNavigate();

  // If navigated back from the Add/Edit component page, prefer the passed selectedKit and keep it selected
  useEffect(() => {
    const navState = (location.state as any) ?? {};
    const passedSelectedKit = navState.selectedKit;
    if (passedSelectedKit) {
      // set selected kit and kit code
      const kit = salesKits.find((k: any) => String(k.item_code) === String(passedSelectedKit));
      setFormData((prev) => ({
        ...prev,
        selectedKit: String(passedSelectedKit),
        kitCode: kit?.item_code ?? String(passedSelectedKit),
        description: navState.kitDescription ?? kit?.description ?? prev.description,
        category: String(navState.kitCategoryId ?? kit?.category_id ?? prev.category),
      }));
      setSelectedKitCode(String(passedSelectedKit));

      // Clear navigation state so it doesn't reapply on future navigations
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
    // We only want to run this when route location changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Allow stock_id to be passed via location.state or query param
  const stateStockId = (location.state as any)?.stock_id;
  const queryStockId = new URLSearchParams(location.search).get("stock_id");
  const [assignedStockId, setAssignedStockId] = useState<string | null>(stateStockId ?? queryStockId ?? null);

  useEffect(() => {
    if (!assignedStockId && stateStockId) setAssignedStockId(String(stateStockId));
  }, [stateStockId]);

  // Fetch existing sales kits (item_codes where is_foreign=0)
  const { data: existingKitsData = [], isLoading: kitsLoading } = useQuery({
    queryKey: ["item-codes"],
    queryFn: () => getItemCodes(),
  });
  const existingKits = (existingKitsData && (existingKitsData.data ?? existingKitsData)) ?? [];
  // Group rows by item_code to present a single kit entry per kit code (avoid showing per-component rows)
  const kitsMap = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of existingKits) {
      // only treat non-foreign item_codes as sales kits
      if (row && row.item_code && (row.is_foreign === 0 || row.is_foreign === undefined || row.is_foreign === null)) {
        const key = String(row.item_code);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      }
    }
    return map;
  }, [existingKits]);

  const salesKits = React.useMemo(() => {
    const arr: any[] = [];
    for (const [item_code, rows] of kitsMap.entries()) {
      // try to find a header-like row (no stock_id) or fallback to the first row
      const header = rows.find((r: any) => !r.stock_id) || rows[0];
      arr.push({
        item_code,
        id: header.id,
        description: header.description || rows[0].description || "",
        category_id: header.category_id ?? rows[0].category_id ?? "",
        quantity: header.quantity ?? "",
        rows,
      });
    }
    // sort alphabetically by item_code for stable order
    return arr.sort((a, b) => String(a.item_code).localeCompare(String(b.item_code)));
  }, [kitsMap]);

  // Fetch items for components
  const { data: itemsData = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => getItems(),
  });
  const items = (itemsData && (itemsData.data ?? itemsData)) ?? [];

  // Fetch item units (units of measure) so we can display unit text instead of a hardcoded value
  const { data: itemUnitsData = [], isLoading: itemUnitsLoading } = useQuery({
    queryKey: ["item-units"],
    queryFn: () => (import("../../../../api/ItemUnit/ItemUnitApi").then(mod => mod.getItemUnits())),
  });
  const itemUnits = (itemUnitsData && (itemUnitsData.data ?? itemUnitsData)) ?? [];
  // Fetch categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["item-categories"],
    queryFn: () => getItemCategories(),
  });
  const categories = (categoriesData && (categoriesData.data ?? categoriesData)) ?? [];

  // Handle selecting existing sales kit
  const handleKitChange = (e: any) => {
    const selectedValue = e.target.value;
    if (selectedValue === "new") {
      setFormData({
        ...formData,
        selectedKit: "new",
        kitCode: "",
        description: "",
        category: "",
        quantity: "",
      });
      setSelectedKitCode("");
    } else {
      // selectedValue is the item_code (we render item_code as the menu value)
      const selectedKit = salesKits.find((kit: any) => String(kit.item_code) === String(selectedValue));
      if (selectedKit) {
        setFormData({
          ...formData,
          selectedKit: selectedValue,
          kitCode: selectedKit.item_code || selectedValue,
          description: selectedKit.description || "",
          category: String(selectedKit.category_id ?? ""),
          quantity: selectedKit.quantity ?? "",
        });
        setSelectedKitCode(selectedKit.item_code || selectedValue);
      }
    }
    setErrors({ ...errors, selectedKit: "" });
  };

  // Handle component change
  const handleComponentChange = (e: any) => {
    const selectedName = e.target.value;
    const selectedItem = items.find((item: any) => item.description === selectedName);
    console.log("Selected item:", selectedItem); // Debug
    if (selectedItem) {
      setFormData((prev) => ({
        ...prev,
        component: selectedName,
        componentCode: resolveStockId(selectedItem),
      }));
    }
    setErrors({ ...errors, component: "" });
  };

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

  const validate = () => {
    const newErrors: Partial<SalesKitFormData> = {};
    if (!formData.kitCode.trim()) newErrors.kitCode = "Kit Code is required";
    if (!formData.component) newErrors.component = "Component is required";
    if (!formData.componentCode) newErrors.componentCode = "Component stock ID is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.quantity || !WHOLE_NUMBER.test(formData.quantity) || parseInt(formData.quantity, 10) < 1) {
      newErrors.quantity = "Quantity must be a whole number of at least 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Components for currently selected kit (by item_code)
  const kitComponents = selectedKitCode ? existingKits.filter((code: any) => code.item_code === selectedKitCode && code.stock_id) : [];

  const paginatedComponents = React.useMemo(() => {
    if (rowsPerPage === -1) return kitComponents;
    return kitComponents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [kitComponents, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Update kit (update description/category for all rows with item_code)
  const handleUpdateKit = async () => {
    if (!selectedKitCode) return;
    try {
      const kitRows = existingKits.filter((code: any) => code.item_code === selectedKitCode);
      for (const row of kitRows) {
        await (await import("../../../../api/ItemCodes/ItemCodesApi")).updateItemCode(row.id, {
          ...row,
          description: formData.description,
          category_id: formData.category,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      // alert("Kit updated successfully");
      setOpen(true);
    } catch (error) {
      console.error("Error updating kit:", error);
      //alert("Error updating kit");
      setErrorMessage("Error updating kit");
      setErrorOpen(true);
    }
  };

  // Add component to kit
  const handleAddComponent = async () => {
    if (!formData.selectedKit || formData.selectedKit === "new" || !addComponentData.component || !addComponentData.quantity) return;
    // addComponentData.component now holds stock_id (or item id)
    const selectedItem = items.find((item: any) => String(item.stock_id ?? item.id) === String(addComponentData.component));
    if (!selectedItem) return;
    try {
      // formData.selectedKit now stores the item_code
      const selectedKitData = salesKits.find((kit: any) => String(kit.item_code) === String(formData.selectedKit));
      const itemCodeToUse = selectedKitData?.item_code ?? formData.kitCode;
      // Per backend requirement: store the sales kit's description on component rows
      await (await import("../../../../api/ItemCodes/ItemCodesApi")).createItemCode({
        item_code: itemCodeToUse,
        description: selectedKitData?.description ?? formData.description ?? selectedItem.description ?? selectedItem.item_name ?? selectedItem.name,
        category_id:
          selectedKitData?.category_id ??
          selectedKitData?.rows?.[0]?.category_id ??
          selectedItem?.category_id ??
          formData.category,
        quantity: addComponentData.quantity,
        is_foreign: 0,
        stock_id: resolveStockId(selectedItem),
      });
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      setAddComponentData({ component: "", quantity: "" });
      alert("Component added successfully");
    } catch (error) {
      console.error("Error adding component:", error);
      setErrorMessage(getFriendlyApiErrorMessage(error));
      setErrorOpen(true);
    }
  };

  // Load existing component row into Add Component form for editing
  const handleLoadComponentForEdit = (componentRow: any) => {
    // componentRow.stock_id holds the selected item's id
    setAddComponentData({ component: componentRow.stock_id ?? componentRow.stock_id ?? componentRow.id, quantity: String(componentRow.quantity ?? "") });
    setEditComponentId(String(componentRow.id));
    // ensure the kit selection is set (it already should be when viewing components)
    setSelectedKitCode(componentRow.item_code ?? selectedKitCode);
    setFormData((prev) => ({ ...prev, selectedKit: componentRow.item_code ?? prev.selectedKit }));
    // scroll into view - optional UX: focus the component select
    const el = document.querySelector('select[name="component"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Update existing component
  const handleUpdateComponent = async () => {
    if (!editComponentId) return;
    if (!addComponentData.component || !addComponentData.quantity) return;
    try {
      const selectedItem = items.find((item: any) => String(item.stock_id ?? item.id) === String(addComponentData.component));
      const selectedKitData = salesKits.find((kit: any) => String(kit.item_code) === String(formData.selectedKit));
      const payload = {
        item_code: selectedKitData?.item_code ?? formData.kitCode,
        description: selectedKitData?.description ?? formData.description,
        category_id: selectedKitData?.category_id ?? selectedKitData?.rows?.[0]?.category_id,
        quantity: addComponentData.quantity,
        is_foreign: 0,
        stock_id: selectedItem ? (selectedItem.stock_id ?? selectedItem.id) : addComponentData.component,
      };
      await (await import("../../../../api/ItemCodes/ItemCodesApi")).updateItemCode(editComponentId, payload);
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      setAddComponentData({ component: "", quantity: "" });
      setEditComponentId(null);
      alert("Component updated successfully");
    } catch (error) {
      console.error("Error updating component:", error);
      alert("Error updating component");
    }
  };

  const handleCancelEditComponent = () => {
    setAddComponentData({ component: "", quantity: "" });
    setEditComponentId(null);
  };

  // Edit quantity handling
  const handleEditQuantity = (id: string, currentQuantity: string) => {
    setEditQuantityData({ id, quantity: currentQuantity });
    setEditQuantityDialog(true);
  };

  const handleSaveQuantity = async () => {
    try {
      const row = existingKits.find((code: any) => code.id === editQuantityData.id);
      await (await import("../../../../api/ItemCodes/ItemCodesApi")).updateItemCode(editQuantityData.id, {
        ...row,
        quantity: editQuantityData.quantity,
      });
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      setEditQuantityDialog(false);
      alert("Quantity updated successfully");
    } catch (error) {
      console.error("Error updating quantity:", error);
      alert("Error updating quantity");
    }
  };

  // Delete component
  const handleDeleteClick = (id: string) => {
    setSelectedId(Number(id));
    setOpenDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedId) return;
    try {
      await (await import("../../../../api/ItemCodes/ItemCodesApi")).deleteItemCode(String(selectedId));
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      setOpenDeleteModal(false);
      setSelectedId(null);
    } catch (error) {
      console.error("Error deleting component:", error);
      setErrorMessage("Error deleting component");
      setErrorOpen(true);
      setOpenDeleteModal(false);
      setSelectedId(null);
    }
  };

  const handleSubmit = async () => {
    if (validate()) {
      // Build payload matching item_codes table
      try {
        const res = await createItemCode({
          item_code: formData.kitCode,
          stock_id: formData.componentCode,
          description: formData.description,
          category_id: formData.category,
          quantity: formData.quantity,
          is_foreign: 0,
        });
        console.log("Created sales kit:", res);
        await queryClient.invalidateQueries({ queryKey: ["item-codes"], exact: false, refetchType: "all" });
        setOpen(true);
        setFormData({
          selectedKit: "new",
          kitCode: "",
          component: "",
          componentCode: "",
          description: "",
          category: "",
          quantity: "",
        });
      } catch (err: unknown) {
        console.error("Failed to create sales kit:", err);
        setErrorMessage(getFriendlyApiErrorMessage(err));
        setErrorOpen(true);
      }
    }
  };

  return (
    <FormPageLayout>
      {/* Header similar to ForeignItemCodesTable */}
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          marginY: 2,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <PageTitle title="Sales Kits" />
          <Breadcrumb breadcrumbs={[{ title: "Home", href: "/dashboard" }, { title: "Sales Kits" }]} />
        </Box>

        {/* center select */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <FormControl sx={{ minWidth: 320 }} size="small">
            <InputLabel>Select Kit</InputLabel>
            <Select
              value={selectedKitCode || formData.selectedKit}
              label="Select Kit"
              onChange={(e) => handleKitChange(e)}
            >
              <MenuItem value="new">+ Add New Sales Kit</MenuItem>
              {kitsLoading ? (
                <MenuItem disabled value="">
                  Loading...
                </MenuItem>
              ) : salesKits.length > 0 ? (
                salesKits.map((kit: any) => (
                  <MenuItem key={kit.item_code} value={kit.item_code}>
                    {kit.item_code} - {kit.description}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled value="">
                  No existing kits
                </MenuItem>
              )}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/itemsandinventory/maintenance/')}>Back</Button>
        </Box>
      </Box>
      {/* Main content */}
      <Stack alignItems="center" sx={{ mt: 0, px: isMobile ? 2 : 0 }}>
        <Paper
          sx={{
            p: theme.spacing(3),
            maxWidth: "900px",
            width: "100%",
            boxShadow: 2,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
            {formData.selectedKit === 'new' ? 'Add Sales Kit' : 'Edit Sales Kit'}
          </Typography>

          <Stack spacing={2}>
            {/* Keep the existing form markup — selection is handled in the header, so remove the duplicate select here */}

            {/* Show form fields */}
            {formData.selectedKit === "new" ? (
              <>
                <TextField
                  label="Kit Code"
                  name="kitCode"
                  size="small"
                  fullWidth
                  value={formData.kitCode}
                  onChange={handleInputChange}
                  error={!!errors.kitCode}
                  helperText={errors.kitCode || " "}
                />

                {/* Component dropdown + code in one row */}
                <Stack direction={isMobile ? "column" : "row"} spacing={2}>
                  <FormControl size="small" fullWidth error={!!errors.component}>
                    <InputLabel>Component Name</InputLabel>
                    <Select
                      name="component"
                      value={formData.component}
                      onChange={handleComponentChange}
                      label="Component Name"
                    >
                      <MenuItem value="">Select component</MenuItem>
                      {itemsLoading ? (
                        <MenuItem disabled value="">
                          Loading...
                        </MenuItem>
                      ) : items.length > 0 ? (
                        (() => {
                          return Object.entries(
                            items.reduce((groups: Record<string, any[]>, item) => {
                              const catId = item.category_id || "Uncategorized";
                              if (!groups[catId]) groups[catId] = [];
                              groups[catId].push(item);
                              return groups;
                            }, {} as Record<string, any[]>)
                          ).map(([categoryId, groupedItems]: [string, any[]]) => {
                            const category = categories.find(cat => cat.category_id === Number(categoryId));
                            const categoryLabel = category ? category.description : `Category ${categoryId}`;
                            return [
                              <ListSubheader key={`cat-${categoryId}`}>
                                {categoryLabel}
                              </ListSubheader>,
                              groupedItems.map((item) => {
                                const stockId = resolveStockId(item);
                                if (!stockId) return null;
                                const label = item.item_name ?? item.name ?? item.description ?? stockId;
                                const value = item.description;
                                return (
                                  <MenuItem key={stockId} value={value}>
                                    {label}
                                  </MenuItem>
                                );
                              })
                            ];
                          });
                        })()
                      ) : (
                        <MenuItem disabled value="">
                          No items available
                        </MenuItem>
                      )}
                    </Select>
                    <FormHelperText>{errors.component || " "}</FormHelperText>
                  </FormControl>

                  <TextField
                    label="Component Code (Stock ID)"
                    name="componentCode"
                    size="small"
                    fullWidth
                    value={formData.componentCode}
                    InputProps={{ readOnly: true }}
                    error={!!errors.componentCode}
                    helperText={errors.componentCode || " "}
                  />
                </Stack>

                <TextField
                  label="Description"
                  name="description"
                  size="small"
                  fullWidth
                  value={formData.description}
                  onChange={handleInputChange}
                  error={!!errors.description}
                  helperText={errors.description || " "}
                />

                <FormControl size="small" fullWidth error={!!errors.category}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="category"
                    value={formData.category}
                    onChange={handleSelectChange}
                    label="Category"
                  >
                    {/* Fetch categories from API */}
                    {categoriesLoading ? (
                      <MenuItem disabled value="">
                        Loading...
                      </MenuItem>
                    ) : categories.length > 0 ? (
                      categories.map((cat: any) => (
                        <MenuItem key={cat.category_id ?? cat.id} value={String(cat.category_id ?? cat.id)}>
                          {cat.description ?? cat.name ?? cat.category_name ?? cat.title ?? String(cat.category_id ?? cat.id)}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled value="">
                        No categories
                      </MenuItem>
                    )}
                  </Select>
                  <FormHelperText>{errors.category || " "}</FormHelperText>
                </FormControl>

                <FormattedNumberField
                  label="Quantity (Kits)"
                  name="quantity"
                  size="small"
                  fullWidth
                  value={formData.quantity}
                  onChange={handleInputChange}
                  error={!!errors.quantity}
                  helperText={errors.quantity || " "}
                />
              </>
            ) : (
              // Update form: only show description and category
              (<>
                <TextField
                  label="Description"
                  name="description"
                  size="small"
                  fullWidth
                  value={formData.description}
                  onChange={handleInputChange}
                  error={!!errors.description}
                  helperText={errors.description || " "}
                />
                <FormControl size="small" fullWidth error={!!errors.category}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="category"
                    value={formData.category}
                    onChange={handleSelectChange}
                    label="Category"
                  >
                    {categoriesLoading ? (
                      <MenuItem disabled value="">
                        Loading...
                      </MenuItem>
                    ) : categories.length > 0 ? (
                      categories.map((cat: any) => (
                        <MenuItem key={cat.category_id ?? cat.id} value={String(cat.category_id ?? cat.id)}>
                          {cat.description ?? cat.name ?? cat.category_name ?? cat.title ?? String(cat.category_id ?? cat.id)}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled value="">
                        No categories
                      </MenuItem>
                    )}
                  </Select>
                  <FormHelperText>{errors.category || " "}</FormHelperText>
                </FormControl>
              </>)
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
            <Button onClick={() => navigate(-1)}>Back</Button>

            {formData.selectedKit === "new" ? (
              <Button disabled={!canEdit}
                variant="contained"
                fullWidth={isMobile}
                sx={{ backgroundColor: "var(--pallet-blue)" }}
                onClick={handleSubmit}
              >
                Add
              </Button>
            ) : (
              <Button
                variant="contained"
                fullWidth={isMobile}
                sx={{ backgroundColor: "var(--pallet-blue)" }}
                onClick={handleUpdateKit}
              >
                Update Kit
              </Button>
            )}
          </Box>
        </Paper>

        {/* If an existing kit is selected, show components table and add-component form */}
        {formData.selectedKit !== "new" && selectedKitCode && (
          <Box sx={{ width: "100%", mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1, mr: 2 }}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => navigate('/itemsandinventory/maintenance/add-saleskit-component', { state: { item_code: selectedKitCode, kitDescription: formData.description, kitCategoryId: formData.category } })}
                sx={{ height: 36 }}
              >
                Add Component
              </Button>
            </Box>

            <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", width: "100%", maxWidth: "100%" }}>
              <Table aria-label="kit components table">
                <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                  <TableRow>
                    <TableCell>No</TableCell>
                    <TableCell>Stock Item</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Units</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {paginatedComponents.length > 0 ? (
                    paginatedComponents.map((component: any, index: number) => {
                      const correspondingItem = items.find((item: any) => item.stock_id === component.stock_id);
                      return (
                        <TableRow key={component.id} hover>
                          <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                          <TableCell>{component.stock_id}</TableCell>
                          <TableCell>{correspondingItem?.description || component.description}</TableCell>
                          <TableCell>{component.quantity}</TableCell>
                          <TableCell>
                            {
                              // Prefer the unit defined on the item (item.units) mapped via itemUnits lookup
                              (() => {
                                const item = correspondingItem;
                                if (item) {
                                  const unitId = item.units ?? item.unit ?? item.unit_id;
                                  if (unitId && itemUnits && itemUnits.length > 0) {
                                    const u = itemUnits.find((uu: any) => String(uu.id) === String(unitId));
                                    if (u) return u.description ?? u.name ?? u.abbr ?? String(unitId);
                                  }
                                  // Fallbacks: check for unit-ish fields on item
                                  return item.unit_name ?? item.unit ?? item.units ?? "each";
                                }
                                // lastly try component row's unit fields
                                return component.unit ?? component.units ?? "each";
                              })()
                            }
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => navigate('/itemsandinventory/maintenance/add-saleskit-component', { state: { item_code: component.item_code, componentRow: component, kitDescription: formData.description, kitCategoryId: formData.category } })}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleDeleteClick(component.id)}
                              >
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2">No Records Found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>

                <TableFooter>
                  <TableRow>
                    <TablePagination
                      rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                      colSpan={6}
                      count={kitComponents.length}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={handleChangePage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      showFirstButton
                      showLastButton
                    />
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>

            {/* Add Component moved to a dedicated page; Add/Edit buttons above/beside table */}
          </Box>
        )}
      </Stack>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="New alias code has been created successfully!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => window.history.back()}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Sales Kit Component"
        content="Are you sure you want to delete this sales kit component? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setOpenDeleteModal(false)}
        deleteFunc={handleDeleteConfirm}
        onSuccess={() => {}}
      />
    </FormPageLayout>
  );
}
