import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { useLocation, useNavigate } from "react-router-dom";
import { updateItemCode } from "../../../../api/ItemCodes/ItemCodesApi";
import queryClient from "../../../../state/queryClient";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
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
} from "@mui/material";
import theme from "../../../../theme";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
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

export default function UpdateForeignItemCodesForm() {
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
  const itemCodeFromState = (location.state as any)?.itemCode ?? null;
  const stateStockId = (location.state as any)?.stock_id ?? null;

  useEffect(() => {
    if (itemCodeFromState) {
      setFormData({
        upcCode: itemCodeFromState.item_code ?? itemCodeFromState.code ?? "",
        quantity: itemCodeFromState.quantity ?? "",
        description: itemCodeFromState.description ?? "",
        category: String(itemCodeFromState.category_id ?? itemCodeFromState.category ?? ""),
      });
    }
  }, [itemCodeFromState]);

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["item-categories"],
    queryFn: () => getItemCategories(),
  });
  const categories = (categoriesData && (categoriesData.data ?? categoriesData)) ?? [];

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
    const newErrors: Partial<ForeignItemFormData> = {};
    if (!formData.upcCode.trim()) newErrors.upcCode = "UPC/EAN Code is required";
    if (!formData.quantity || !WHOLE_NUMBER.test(formData.quantity) || parseInt(formData.quantity, 10) < 1) {
      newErrors.quantity = "Quantity must be a whole number of at least 1";
    }
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.category) newErrors.category = "Category is required";

    const stockMissing = !stateStockId || String(stateStockId).trim() === "";
    setStockIdError(stockMissing ? "Linked inventory item is missing. Return to the list and open edit again." : "");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && !stockMissing;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const id = itemCodeFromState?.id ?? itemCodeFromState?.code_id ?? null;
    if (!id) {
      setErrorMessage("Cannot update: missing item code id.");
      setErrorOpen(true);
      return;
    }

    try {
      const res = await updateItemCode(id, {
        item_code: formData.upcCode,
        stock_id: stateStockId,
        description: formData.description,
        category_id: formData.category,
        quantity: formData.quantity,
        is_foreign: 1,
      });
      console.log("Updated item code:", res);
      await queryClient.invalidateQueries({ queryKey: ["item-codes"], exact: false, refetchType: "all" });
      setOpen(true);
      setFormData({ upcCode: "", quantity: "", description: "", category: "" });
    } catch (err: unknown) {
      console.error("Failed to update item code:", err);
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
          Update Foreign Item Code
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Linked inventory item (Stock ID)"
            size="small"
            fullWidth
            value={stateStockId ?? ""}
            InputProps={{ readOnly: true }}
            error={!!stockIdError}
            helperText={stockIdError || " "}
          />

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
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Item code has been updated!"
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
