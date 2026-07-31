import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getItems } from "../../../../api/Item/ItemApi";
import { createItemCode, updateItemCode } from "../../../../api/ItemCodes/ItemCodesApi";
import queryClient from "../../../../state/queryClient";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { resolveStockId } from "../../../../utils/itemCodePayload";
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
  ListSubheader,
} from "@mui/material";
import theme from "../../../../theme";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function AddSalesKitComponentPage() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales kits');
  const location = useLocation();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // state passed from table: { item_code, componentRow? }
  const state = (location.state as any) ?? {};
  const item_code = state.item_code ?? "";
  const componentRow = state.componentRow ?? null;

  const { data: itemsData = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });
  const items = (itemsData && (itemsData.data ?? itemsData)) ?? [];

  const { data: categories = [] } = useQuery({
    queryKey: ["itemCategories"],
    queryFn: () => import("../../../../api/ItemCategories/ItemCategoriesApi").then(m => m.getItemCategories()) as Promise<{ category_id: number; description: string }[]>,
  });

  const [form, setForm] = useState({ stock_id: "", quantity: "" });
  const [errors, setErrors] = useState<{ stock_id?: string; quantity?: string }>({});

  useEffect(() => {
    if (componentRow) {
      setForm({ stock_id: String(componentRow.stock_id ?? componentRow.id ?? ""), quantity: String(componentRow.quantity ?? "") });
    }
  }, [componentRow]);

  const validate = () => {
    const e: typeof errors = {};
    if (!form.stock_id) e.stock_id = "Component is required";
    if (!form.quantity || !/^\d+$/.test(form.quantity) || parseInt(form.quantity, 10) < 1) {
      e.quantity = "Quantity must be a whole number of at least 1";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      const selectedItem = items.find((it: any) => String(it.stock_id ?? it.id) === String(form.stock_id));
      const payload = {
        item_code: item_code,
        description: componentRow?.description ?? (state.kitDescription ?? selectedItem?.description ?? selectedItem?.item_name ?? selectedItem?.name ?? ""),
        category_id:
          state.kitCategoryId ??
          componentRow?.category_id ??
          selectedItem?.category_id ??
          categories[0]?.category_id,
        quantity: form.quantity,
        is_foreign: 0,
        stock_id: selectedItem ? resolveStockId(selectedItem) : form.stock_id,
      };

      if (componentRow && componentRow.id) {
        await updateItemCode(componentRow.id, payload);
      } else {
        await createItemCode(payload);
      }

      // Ensure all item-codes queries (active & inactive) are refetched so the table updates immediately
      await queryClient.invalidateQueries({ queryKey: ["item-codes"], refetchType: 'all' });

      // Navigate back to the sales kits page and pass the selected kit so the kit page remains selected
      navigate('/itemsandinventory/maintenance/sales-kits', {
        state: {
          selectedKit: item_code,
          kitDescription: state.kitDescription,
          kitCategoryId: state.kitCategoryId,
          refreshKey: Date.now(),
        },
      });
    } catch (err) {
      console.error(err);
      setErrorMessage(getFriendlyApiErrorMessage(err));
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: theme.spacing(3), maxWidth: "800px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>{componentRow ? "Update Component" : "Add Component"}</Typography>

        <Stack spacing={2}>
          <TextField label="Kit Code" size="small" fullWidth value={item_code} InputProps={{ readOnly: true }} />

          <FormControl size="small" fullWidth error={!!errors.stock_id}>
            <InputLabel>Component</InputLabel>
            <Select name="stock_id" value={form.stock_id} label="Component" onChange={(e) => setForm({ ...form, stock_id: e.target.value as string })}>
              <MenuItem value="">Select component</MenuItem>
              {itemsLoading ? (
                <MenuItem disabled value="">Loading...</MenuItem>
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
                        return (
                          <MenuItem key={stockId} value={stockId}>
                            {label}
                          </MenuItem>
                        );
                      })
                    ];
                  });
                })()
              ) : (
                <MenuItem disabled value="">No items available</MenuItem>
              )}
            </Select>
            <FormHelperText>{errors.stock_id || " "}</FormHelperText>
          </FormControl>

          <FormattedNumberField label="Quantity" name="quantity" size="small" fullWidth value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} error={!!errors.quantity} helperText={errors.quantity || " "} />

          <Box sx={{ display: 'flex', mt: 2, flexDirection: isMobile ? 'column' : 'row', alignItems: 'center' }}>
            {/* Cancel on the left - keep selected kit on return */}
            <Button
              variant="outlined"
              onClick={() => navigate('/itemsandinventory/maintenance/sales-kits', {
                state: {
                  selectedKit: item_code,
                  kitDescription: state.kitDescription,
                  kitCategoryId: state.kitCategoryId,
                },
              })}
            >
              Cancel
            </Button>

            {/* Action on the right */}
            <Box sx={{ ml: isMobile ? 0 : 'auto', display: 'flex', width: isMobile ? '100%' : 'auto' }}>
              <Button disabled={!canEdit}
                variant="contained"
                fullWidth={isMobile}
                sx={{ backgroundColor: 'var(--pallet-blue)', color: '#fff', height: 36 }}
                onClick={handleSave}
              >
                {componentRow ? 'Update' : 'Add'}
              </Button>
            </Box>
          </Box>
        </Stack>
      </Paper>
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
    </FormPageLayout>
  );
}
