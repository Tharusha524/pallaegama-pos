import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getItems } from "../../../../api/Item/ItemApi";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getWorkCentres } from "../../../../api/WorkCentre/WorkCentreApi";
import { getBomById, updateBom, getBoms } from "../../../../api/Bom/BomApi";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  ListSubheader,
} from "@mui/material";
import theme from "../../../../theme";
import ErrorModal from "../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface BillsOfMaterialFormData {
  componentCode: string;
  componentName: string;
  location: string;
  workCentre: string;
  quantity: string;
}

export default function UpdateBillsOfMaterialForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Bill of Materials');
  const [formData, setFormData] = useState<BillsOfMaterialFormData>({
    componentCode: "",
    componentName: "",
    location: "",
    workCentre: "",
    quantity: "",
  });

  const [errors, setErrors] = useState<Partial<BillsOfMaterialFormData>>({});
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState(false);

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get the itemCode from location.state
  const itemCode = (location.state as any)?.itemCode;

  // Fetch items for component selection
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });

  // Fetch inventory locations
  const { data: inventoryLocations = [] } = useQuery({
    queryKey: ["inventoryLocations"],
    queryFn: getInventoryLocations,
  });

  // Fetch categories using React Query
  const { data: categories = [] } = useQuery<{ category_id: number; description: string }[]>({
    queryKey: ["itemCategories"],
    queryFn: () => getItemCategories() as Promise<{ category_id: number; description: string }[]>,
  });

  // Allow stock_id to be passed via location.state or query param
  const stateStockId = (location.state as any)?.stock_id;
  const queryStockId = new URLSearchParams(location.search).get("stock_id");
  const [assignedStockId, setAssignedStockId] = useState<string | null>(stateStockId ?? queryStockId ?? null);

  // BOM id from route params (supports :id or :bomId) or from location.state
  const params = useParams();
  const routeBomId = (params as any)?.id ?? (params as any)?.bomId ?? null;
  const stateBom = (location.state as any)?.itemCode ?? null;

  // Fetch BOM by id when routeBomId exists
  const { data: rawBom } = useQuery({
    queryKey: routeBomId ? ["bom", routeBomId] : ["bom", "none"],
    enabled: !!routeBomId,
    queryFn: () => getBomById(Number(routeBomId)),
  });
  const bomRecord = rawBom?.data ?? rawBom ?? null;

  // Pre-populate form with BOM data from navigation state or backend
  useEffect(() => {
    const source = itemCode ?? stateBom ?? bomRecord;
    if (source) {
      setFormData({
        componentCode: source.component ?? source.component_stock_id ?? source.component_id ?? "",
        componentName: source.component_name ?? source.description ?? "",
        location: source.loc_code,
        workCentre: String(source.work_centre ?? source.work_centre_id ?? ""),
        quantity: String(source.quantity ?? ""),
      });
      if (!assignedStockId) setAssignedStockId(source.parent ?? source.parent_stock_id ?? source.parent_id ?? null);
    }
  }, [itemCode, stateBom, bomRecord]);

  // Update component name when component code is set
  useEffect(() => {
    if (formData.componentCode && items && items.length > 0) {
      const selectedComponent = items.find((item: any) => String(item.stock_id ?? item.id) === String(formData.componentCode));
      if (selectedComponent) {
        setFormData(prev => ({
          ...prev,
          componentName: selectedComponent.item_name ?? selectedComponent.name ?? selectedComponent.description ?? ""
        }));
      }
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
      // Check for duplicate BOM (excluding current one)
      const duplicate = boms.find((bom: any) =>
        bom.id !== (bomRecord?.id ?? Number(routeBomId)) &&
        String(bom.parent ?? bom.parent_stock_id ?? bom.parent_id) === String(assignedStockId) &&
        String(bom.component ?? bom.component_stock_id ?? bom.component_id) === String(formData.componentCode) &&
        String(bom.loc_code) === String(formData.location) &&
        String(bom.work_centre ?? bom.work_centre_id) === String(formData.workCentre)
      );

      if (duplicate) {
        setErrorMessage("The selected component is already on this bom. You can modify it's quantity but it cannot appear more than once on the same bom.");
        setErrorOpen(true);
        return;
      }

      // Build payload for updating bills of material
      const payload = {
        component: formData.componentCode,
        component_name: formData.componentName,
        parent: assignedStockId,
        loc_code: formData.location,
        work_centre: formData.workCentre,
        quantity: Number(formData.quantity) || 0,
      };

      const bomId = bomRecord?.id ?? Number(routeBomId);
      if (bomId) {
        updateMutation.mutate({ id: bomId, data: payload });
      } else {
        setErrorMessage("BOM ID not found");
        setErrorOpen(true);
      }
    }
  };

  const { data: workCentres = [] } = useQuery({
    queryKey: ["workCentres"],
    queryFn: getWorkCentres,
  });

  // Fetch existing BOMs to check for duplicates
  const { data: boms = [] } = useQuery({
    queryKey: ["boms"],
    queryFn: getBoms,
  });

  // Mutation for updating BOM
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateBom(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boms"] });
      queryClient.invalidateQueries({ queryKey: ["bom", routeBomId] });
      // alert("Bills of Material updated successfully!");
      setOpen(true);
    },
    onError: (err: any) => {
      console.error("Failed to update bills of material:", err);
      setErrorMessage("Failed to update bills of material");
      setErrorOpen(true);
    },
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
          Update Bills of Material
        </Typography>

        <Stack spacing={2}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            <TextField
              label="Component Name"
              value={formData.componentName}
              size="small"
              sx={{ flex: 1 }}
              InputProps={{
                readOnly: true,
              }}
            />

            <TextField
              label="Component Code"
              value={formData.componentCode}
              size="small"
              sx={{ flex: 1 }}
              InputProps={{
                readOnly: true,
              }}
            />
          </Box>

          <FormControl size="small" fullWidth error={!!errors.location}>
            <InputLabel>Location to Draw From</InputLabel>
            <Select
              name="location"
              value={formData.location}
              onChange={handleSelectChange}
              label="Location to Draw From"
            >
              {inventoryLocations && inventoryLocations.length > 0 ? (
                inventoryLocations.map((loc: any) => (
                  <MenuItem key={loc.loc_code ?? loc.location_id ?? loc.id} value={String(loc.loc_code ?? loc.location_id ?? loc.id)}>
                    {loc.location_name ?? loc.name ?? loc.description ?? String(loc.loc_code ?? loc.location_id ?? loc.id)}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled value="">
                  No locations available
                </MenuItem>
              )}
            </Select>
            <FormHelperText>{errors.location || " "}</FormHelperText>
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
            Update Bills of Material
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Selected component has been updated successfully!"
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
