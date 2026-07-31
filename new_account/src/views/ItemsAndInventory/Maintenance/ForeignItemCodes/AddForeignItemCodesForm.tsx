import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { useLocation, useNavigate } from "react-router-dom";
import { createItemCode } from "../../../../api/ItemCodes/ItemCodesApi";
import queryClient from "../../../../state/queryClient";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { resolveStockId } from "../../../../utils/itemCodePayload";
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
  ListSubheader,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface ForeignItemFormData {
  upcCode: string;
  quantity: string;
  description: string;
  category: string;
}

const WHOLE_NUMBER = /^\d+$/;

export default function AddForeignItemCodesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Foreign item codes entry');
  const [formData, setFormData] = useState<ForeignItemFormData>({
    upcCode: "",
    quantity: "",
    description: "",
    category: "",
  });

  const [errors, setErrors] = useState<Partial<ForeignItemFormData>>({});
  const [stockIdError, setStockIdError] = useState("");

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const location = useLocation();
  const navigate = useNavigate();

  // Allow stock_id to be passed via location.state or query param
  const queryStockId = new URLSearchParams(location.search).get("stock_id");
  const stateStockId = (location.state as any)?.stock_id;
  const [assignedStockId, setAssignedStockId] = useState<string>(
    String(stateStockId ?? queryStockId ?? "").trim()
  );

  useEffect(() => {
    const id = String(stateStockId ?? queryStockId ?? "").trim();
    if (id) setAssignedStockId(id);
  }, [stateStockId, queryStockId]);

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });
  const items = (itemsData && (itemsData.data ?? itemsData)) ?? [];

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["item-categories"],
    queryFn: () => getItemCategories(),
  });
  const categories = (categoriesData && (categoriesData.data ?? categoriesData)) ?? [];

  // FrontAccounting-style: default category/description from the linked inventory item
  useEffect(() => {
    if (!assignedStockId || items.length === 0) return;
    const linked = items.find((it: any) => resolveStockId(it) === assignedStockId);
    if (!linked) return;
    setFormData((prev) => ({
      ...prev,
      category: prev.category || String(linked.category_id ?? ""),
      description:
        prev.description ||
        String(linked.description ?? linked.item_name ?? linked.name ?? ""),
    }));
  }, [assignedStockId, items]);

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

  const handleStockItemChange = (stockId: string) => {
    setAssignedStockId(stockId);
    setStockIdError("");
    const linked = items.find((it: any) => resolveStockId(it) === stockId);
    if (linked) {
      setFormData((prev) => ({
        ...prev,
        category: String(linked.category_id ?? prev.category),
        description: String(linked.description ?? linked.item_name ?? linked.name ?? prev.description),
      }));
    }
  };

  const validate = () => {
    const newErrors: Partial<ForeignItemFormData> = {};
    if (!formData.upcCode.trim()) newErrors.upcCode = "UPC/EAN Code is required";
    if (!formData.quantity || !WHOLE_NUMBER.test(formData.quantity) || parseInt(formData.quantity, 10) < 1) {
      newErrors.quantity = "Quantity must be a whole number of at least 1";
    }
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.category) newErrors.category = "Category is required";

    const stockMissing = !assignedStockId || String(assignedStockId).trim() === "";
    setStockIdError(
      stockMissing
        ? "No inventory item selected. Go back and choose an item on the Foreign Item Codes page."
        : ""
    );

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && !stockMissing;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const res = await createItemCode({
        item_code: formData.upcCode,
        stock_id: assignedStockId,
        description: formData.description,
        category_id: formData.category,
        quantity: formData.quantity,
        is_foreign: 1,
      });
      console.log("Created item code:", res);
      await queryClient.invalidateQueries({ queryKey: ["item-codes"], exact: false, refetchType: "all" });
      setOpen(true);
      setFormData({ upcCode: "", quantity: "", description: "", category: "" });
    } catch (err: unknown) {
      console.error("Failed to create item code:", err);
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
          Add Foreign Item Code
        </Typography>

        <Stack spacing={2}>
          <FormControl size="small" fullWidth error={!!stockIdError}>
            <InputLabel>Inventory item (Stock ID)</InputLabel>
            <Select
              value={assignedStockId}
              label="Inventory item (Stock ID)"
              onChange={(e) => handleStockItemChange(e.target.value as string)}
            >
              <MenuItem value="">Select inventory item</MenuItem>
              {itemsLoading ? (
                <MenuItem disabled value="">Loading items...</MenuItem>
              ) : items.length > 0 ? (
                Object.entries(
                  items.reduce((groups: Record<string, any[]>, item) => {
                    const catId = item.category_id || "Uncategorized";
                    if (!groups[catId]) groups[catId] = [];
                    groups[catId].push(item);
                    return groups;
                  }, {} as Record<string, any[]>)
                ).flatMap(([categoryId, groupedItems]: [string, any[]]) => {
                  const category = categories.find(
                    (cat: any) => cat.category_id === Number(categoryId)
                  );
                  const categoryLabel = category
                    ? category.description
                    : `Category ${categoryId}`;
                  return [
                    <ListSubheader key={`cat-${categoryId}`}>{categoryLabel}</ListSubheader>,
                    ...groupedItems.map((item) => {
                      const stockId = resolveStockId(item);
                      if (!stockId) return null;
                      const label =
                        item.description ?? item.item_name ?? item.name ?? stockId;
                      return (
                        <MenuItem key={stockId} value={stockId}>
                          {stockId} — {label}
                        </MenuItem>
                      );
                    }),
                  ];
                })
              ) : (
                <MenuItem disabled value="">No inventory items — create an item first</MenuItem>
              )}
            </Select>
            <FormHelperText>
              {stockIdError || "Foreign code will be linked to this inventory item (FrontAccounting style)."}
            </FormHelperText>
          </FormControl>

          <TextField
            label="UPC/EAN Code"
            name="upcCode"
            size="small"
            fullWidth
            value={formData.upcCode}
            onChange={handleInputChange}
            error={!!errors.upcCode}
            helperText={errors.upcCode || " "}
          />

          <FormattedNumberField
            label="Quantity"
            name="quantity"
            size="small"
            fullWidth
            value={formData.quantity}
            onChange={handleInputChange}
            error={!!errors.quantity}
            helperText={errors.quantity || "Whole number only (minimum 1)"}
            inputProps={{ min: 1, step: 1 }}
          />

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
                <MenuItem disabled value="">Loading...</MenuItem>
              ) : categories.length > 0 ? (
                categories.map((cat: any) => (
                  <MenuItem key={cat.category_id ?? cat.id} value={String(cat.category_id ?? cat.id)}>
                    {cat.description ?? cat.name ?? cat.category_name ?? cat.title ?? String(cat.category_id ?? cat.id)}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled value="">No categories</MenuItem>
              )}
            </Select>
            <FormHelperText>{errors.category || " "}</FormHelperText>
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
            Add Foreign Item
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="New item code has been added!"
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
