import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getItems } from "../../../../api/Item/ItemApi";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getWorkCentres } from "../../../../api/WorkCentre/WorkCentreApi";
import { createBom, getBoms } from "../../../../api/Bom/BomApi";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  useTheme,
  useMediaQuery,
  ListSubheader,
} from "@mui/material";
import theme from "../../../../theme";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import ItemSearchSelect from "../../../../components/ItemSearchSelect";
import { isValidBomLocCode, MAX_BOM_LOC_CODE_LENGTH } from "../../../../utils/bomLocCode";
import {
  BOM_COMPONENT_ALL_BLOCKED_HINT,
  BOM_COMPONENT_EMPTY_HINT,
  BOM_MANUFACTURED_WITHOUT_BOM_MESSAGE,
  buildBomParentStockIds,
  extractBomApiError,
  getBomComponentBlockReason,
  getItemStockId,
  isBomComponentCandidate,
  isBomComponentItem,
  itemMbFlagLabel,
  manufacturedWithoutBom,
} from "../../../../utils/bomComponentItem";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface BillsOfMaterialFormData {
  componentCode: string;
  componentName: string;
  location: string;
  workCentre: string;
  quantity: string;
}

function normalizeItemList(raw: unknown): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: any[] }).data;
  }
  return [];
}

export default function AddBillsOfMaterialForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Bill of Materials');
  const [formData, setFormData] = useState<BillsOfMaterialFormData>({
    componentCode: "",
    componentName: "",
    location: "",
    workCentre: "",
    quantity: "1",
  });

  const [errors, setErrors] = useState<Partial<BillsOfMaterialFormData>>({});
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Parent item passed from BOM table
  const stateStockId = (location.state as any)?.stock_id;
  const queryStockId = new URLSearchParams(location.search).get("stock_id");
  const [assignedStockId] = useState<string | null>(stateStockId ?? queryStockId ?? null);

  // Fetch items for component selection
  const { data: rawItems } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });

  const items = useMemo(() => normalizeItemList(rawItems), [rawItems]);

  const { data: boms = [] } = useQuery({
    queryKey: ["boms"],
    queryFn: getBoms,
  });

  const bomParentStockIds = useMemo(() => buildBomParentStockIds(boms), [boms]);

  const componentItems = useMemo(
    () => items.filter((item) => isBomComponentItem(item, assignedStockId, bomParentStockIds)),
    [items, assignedStockId, bomParentStockIds]
  );

  const componentPickerItems = useMemo(
    () => items.filter((item) => isBomComponentCandidate(item, assignedStockId)),
    [items, assignedStockId]
  );

  const componentPickerHint = useMemo(() => {
    if (items.length === 0) {
      return BOM_COMPONENT_EMPTY_HINT;
    }
    if (componentPickerItems.length === 0) {
      return BOM_COMPONENT_EMPTY_HINT;
    }
    if (componentItems.length === 0) {
      return BOM_COMPONENT_ALL_BLOCKED_HINT;
    }
    if (componentItems.length < componentPickerItems.length) {
      const blocked = componentPickerItems.length - componentItems.length;
      return `${componentItems.length} selectable · ${blocked} greyed out (wrong Item Type — use Purchased or Service)`;
    }
    return `${componentItems.length} items available`;
  }, [items.length, componentItems.length, componentPickerItems.length]);

  // Fetch inventory locations
  const { data: rawInventoryLocations = [] } = useQuery({
    queryKey: ["inventoryLocations"],
    queryFn: getInventoryLocations,
  });

  const inventoryLocations = useMemo(
    () => normalizeItemList(rawInventoryLocations),
    [rawInventoryLocations]
  );

  const bomEligibleLocations = useMemo(
    () =>
      inventoryLocations.filter((loc: any) =>
        isValidBomLocCode(loc?.loc_code)
      ),
    [inventoryLocations]
  );

  const locationsTooLong = useMemo(
    () =>
      inventoryLocations.filter(
        (loc: any) =>
          String(loc?.loc_code ?? "").trim().length > MAX_BOM_LOC_CODE_LENGTH
      ),
    [inventoryLocations]
  );

  // Fetch categories using React Query
  const { data: categories = [] } = useQuery<{ category_id: number; description: string }[]>({
    queryKey: ["itemCategories"],
    queryFn: () => getItemCategories() as Promise<{ category_id: number; description: string }[]>,
  });

  // Update component code and name when component is selected
  useEffect(() => {
    if (formData.componentCode && items && items.length > 0) {
      const selectedComponent = items.find((item: any) => String(item.stock_id ?? item.id) === String(formData.componentCode));
      if (selectedComponent) {
        setFormData(prev => ({
          ...prev,
          componentCode: String(selectedComponent.stock_id ?? selectedComponent.id ?? formData.componentCode),
          componentName: selectedComponent.item_name ?? selectedComponent.name ?? selectedComponent.description ?? ""
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        componentCode: "",
        componentName: ""
      }));
    }
  }, [formData.componentCode, items]);

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
    const newErrors: Partial<BillsOfMaterialFormData> = {};
    if (!formData.componentCode) newErrors.componentCode = "Component is required";
    if (!formData.location) newErrors.location = "Location is required";
    if (!formData.workCentre) newErrors.workCentre = "Work Centre is required";
    if (!formData.quantity) {
      newErrors.quantity = "Quantity is required";
    } else if (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0) {
      newErrors.quantity = "Quantity must be a number greater than zero";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      if (
        formData.componentCode &&
        manufacturedWithoutBom(formData.componentCode, items, bomParentStockIds)
      ) {
        setErrorMessage(BOM_MANUFACTURED_WITHOUT_BOM_MESSAGE);
        setErrorOpen(true);
        return;
      }

      // Location dropdown stores loc_code directly (must match inventory_locations.loc_code)
      const locCode = String(formData.location ?? "").trim();
      if (!isValidBomLocCode(locCode)) {
        setErrorMessage(
          `Location code "${locCode || "(empty)"}" is too long. BOM allows max ${MAX_BOM_LOC_CODE_LENGTH} characters. ` +
            `Edit the location in Items & Inventory → Maintenance → Inventory Locations (e.g. change WH-001 to WH001).`
        );
        setErrorOpen(true);
        return;
      }

      const duplicate = boms.find((bom: any) =>
        String(bom.parent ?? bom.parent_stock_id ?? bom.parent_id) === String(assignedStockId) &&
        String(bom.component ?? bom.component_stock_id ?? bom.component_id) === String(formData.componentCode) &&
        String(bom.loc_code) === String(locCode) &&
        String(bom.work_centre ?? bom.work_centre_id) === String(formData.workCentre)
      );

      if (duplicate) {
        setErrorMessage("The selected component is already on this bom. You can modify it's quantity but it cannot appear more than once on the same bom.");
        setErrorOpen(true);
        return;
      }

      // Build payload for bills of material

      const bomPayload = {
        parent: assignedStockId ?? "",
        component: formData.componentCode,
        work_centre: Number(formData.workCentre) || 0,
        loc_code: String(locCode),
        quantity: Number(formData.quantity) || 0,
      };

      try {
        console.log("Creating BOM with payload:", bomPayload);
        await createBom(bomPayload);
        queryClient.invalidateQueries({ queryKey: ["boms"] });
        //  alert("Bills of Material added successfully!");
        setOpen(true);
        setFormData({ componentCode: "", componentName: "", location: "", workCentre: "", quantity: "1" });
        // go back to table
      } catch (err: unknown) {
        console.error("Failed to create bills of material:", err);
        setErrorMessage(extractBomApiError(err));
        setErrorOpen(true);
      }
    }
  };

  // Fetch work centres from backend
  const { data: workCentres = [] } = useQuery({
    queryKey: ["workCentres"],
    queryFn: getWorkCentres,
  });

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
          Add Bills of Material
        </Typography>

        {componentItems.length === 0 && componentPickerItems.length > 0 ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {BOM_COMPONENT_ALL_BLOCKED_HINT} Open the Component list — greyed items show why they cannot be selected.
          </Alert>
        ) : null}

        <Stack spacing={2}>
          {/* Parent item (preselected from BOM table) */}
          <TextField
            label="Parent Item"
            size="small"
            fullWidth
            value={(() => {
              if (!assignedStockId) return "";
              const parentItem = (items || []).find((it: any) => String(it.stock_id ?? it.id) === String(assignedStockId));
              return parentItem ? (parentItem.item_name ?? parentItem.description ?? parentItem.name ?? String(assignedStockId)) : String(assignedStockId);
            })()}
            InputProps={{ readOnly: true }}
          />
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            <TextField
              label="Component Code"
              value={formData.componentCode}
              size="small"
              sx={{ flex: 1 }}
              InputProps={{
                readOnly: true,
              }}
            />

            <ItemSearchSelect
              label="Component"
              selectedStockId={formData.componentCode}
              value={
                componentPickerItems.find(
                  (it: any) => getItemStockId(it) === formData.componentCode
                )?.description ?? ""
              }
              items={componentPickerItems as any[]}
              categories={categories.map((cat) => ({
                id: cat.category_id,
                category_name: cat.description,
              }))}
              isOptionDisabled={(item) =>
                !isBomComponentItem(item, assignedStockId, bomParentStockIds)
              }
              getOptionDisabledHint={(item) =>
                getBomComponentBlockReason(item, assignedStockId, bomParentStockIds) ??
                `${itemMbFlagLabel(item)} — not valid for BOM`
              }
              onSelect={(item) => {
                if (
                  item &&
                  !isBomComponentItem(item, assignedStockId, bomParentStockIds)
                ) {
                  return;
                }
                setFormData({ ...formData, componentCode: item?.stock_id ?? "" });
                setErrors({ ...errors, componentCode: "" });
              }}
            />
            {(errors.componentCode || componentPickerHint) && (
              <FormHelperText error={!!errors.componentCode}>
                {errors.componentCode || componentPickerHint}
              </FormHelperText>
            )}
          </Box>

          <FormControl size="small" fullWidth error={!!errors.location}>
            <InputLabel>Location to Draw From</InputLabel>
            <Select
              name="location"
              value={formData.location}
              onChange={handleSelectChange}
              label="Location to Draw From"
            >
              {bomEligibleLocations.length > 0 ? (
                bomEligibleLocations.map((loc: any) => {
                  const code = String(loc.loc_code ?? "").trim();
                  return (
                    <MenuItem key={code} value={code}>
                      {loc.location_name ?? loc.name ?? loc.description ?? code} ({code})
                    </MenuItem>
                  );
                })
              ) : (
                <MenuItem disabled value="">
                  No locations with a code of {MAX_BOM_LOC_CODE_LENGTH} characters or less
                </MenuItem>
              )}
            </Select>
            <FormHelperText>
              {errors.location ||
                (locationsTooLong.length > 0
                  ? `Codes longer than ${MAX_BOM_LOC_CODE_LENGTH} chars are hidden (e.g. ${String(locationsTooLong[0]?.loc_code ?? "")}). Shorten them in Inventory Locations.`
                  : `Location code max ${MAX_BOM_LOC_CODE_LENGTH} characters.`)}
            </FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.workCentre}>
            <InputLabel>Work Centre Added</InputLabel>
            <Select
              name="workCentre"
              value={formData.workCentre}
              onChange={handleSelectChange}
              label="Work Centre Added"
            >
              {workCentres.map((wc) => (
                <MenuItem key={wc.id} value={String(wc.id)}>
                  {wc.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.workCentre || " "}</FormHelperText>
          </FormControl>

          <FormattedNumberField
            label="Quantity"
            name="quantity"
            size="small"
            fullWidth
            value={formData.quantity}
            onChange={handleInputChange}
            error={!!errors.quantity}
            helperText={errors.quantity || " "}
          />
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
            Add Bills of Material
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="A new component part has been added to the bill of material for this item!"
        addFunc={async () => { }}
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