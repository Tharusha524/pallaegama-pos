import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Checkbox,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import theme from "../../../../theme";
import { getTaxGroup, updateTaxGroup, getTaxTypes } from "../../../../api/Tax/taxServices";
import { getTaxGroupItemsByGroupId, createTaxGroupItem, updateTaxGroupItem, deleteTaxGroupItem } from "../../../../api/Tax/TaxGroupItemApi";
import { useParams } from "react-router";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface TaxType {
  id: number;
  description: string;
  default_rate: number;
}

interface TaxGroupFormData {
  description: string;
  selectedTaxTypeIds: number[];
  shippingTaxMap: { [taxTypeId: number]: boolean };
}

export default function UpdateTaxGroupsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Tax groups');
  const { id } = useParams<{ id: string }>();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [formData, setFormData] = useState<TaxGroupFormData>({
    description: "",
    selectedTaxTypeIds: [],
    shippingTaxMap: {},
  });

  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<TaxGroupFormData>>({});

  // Fetch tax types for checkbox list
  useEffect(() => {
    getTaxTypes().then(setTaxTypes);
  }, []);

  // Fetch existing tax group and tax group items
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const group = await getTaxGroup(Number(id));
        console.log('Fetched tax group:', group);

        const items = await getTaxGroupItemsByGroupId(Number(id));
        console.log('Fetched tax group items:', items);

        // Filter items to only include those matching the current tax_group_id
        const currentGroupItems = items.filter(item => item.tax_group_id === Number(id));
        console.log('Current group items:', currentGroupItems);

        const formDataUpdate = {
          description: group.description,
          selectedTaxTypeIds: currentGroupItems.map(item => item.tax_type_id),
          shippingTaxMap: Object.fromEntries(currentGroupItems.map(item => [item.tax_type_id, item.tax_shipping])),
        };
        console.log('Setting form data to:', formDataUpdate);

        setFormData(formDataUpdate);
      } catch (err: any) {
        console.error('Error fetching tax group data:', err);
        setErrorMessage(err?.response?.data?.message || "Failed to load tax group data");
        setErrorOpen(true);
      }
    })();
  }, [id]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, description: e.target.value });
  };

  const handleTaxTypeToggle = (taxTypeId: number) => {
    setFormData(prev => {
      const selected = prev.selectedTaxTypeIds.includes(taxTypeId)
        ? prev.selectedTaxTypeIds.filter(id => id !== taxTypeId)
        : [...prev.selectedTaxTypeIds, taxTypeId];

      const shippingTaxMap = { ...prev.shippingTaxMap };
      if (!selected.includes(taxTypeId)) delete shippingTaxMap[taxTypeId];

      return { ...prev, selectedTaxTypeIds: selected, shippingTaxMap };
    });
  };

  const handleShippingTaxToggle = (taxTypeId: number) => {
    if (!formData.selectedTaxTypeIds.includes(taxTypeId)) return;
    setFormData(prev => ({
      ...prev,
      shippingTaxMap: {
        ...prev.shippingTaxMap,
        [taxTypeId]: !prev.shippingTaxMap[taxTypeId],
      },
    }));
  };

  const validate = () => {
    const newErrors: Partial<TaxGroupFormData> = {};
    if (!formData.description) newErrors.description = "Description is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !id) return;
    try {
      // Update main tax group
      await updateTaxGroup(Number(id), { description: formData.description });

      // Fetch current items to detect deletions
      const existingItems = await getTaxGroupItemsByGroupId(Number(id));
      const existingIds = existingItems.map(item => item.tax_type_id);

      // Delete removed tax types
      const toDelete = existingIds.filter(tid => !formData.selectedTaxTypeIds.includes(tid));
      await Promise.all(toDelete.map(tid => deleteTaxGroupItem(Number(id), tid)));

      // Add or update tax types
      await Promise.all(
        formData.selectedTaxTypeIds.map(async taxTypeId => {
          const shipping = formData.shippingTaxMap[taxTypeId] || false; // Default to false if not set
          const existing = existingItems.find(item =>
            item.tax_group_id === Number(id) && item.tax_type_id === taxTypeId
          );

          console.log('Processing tax type:', taxTypeId, {
            exists: !!existing,
            shipping,
            existingShipping: existing?.tax_shipping
          });

          if (existing) {
            // Only update if shipping status changed
            if (existing.tax_shipping !== shipping) {
              console.log('Updating shipping for tax type:', taxTypeId, shipping);
              await updateTaxGroupItem(Number(id), taxTypeId, { tax_shipping: shipping });
            }
          } else {
            // Create new tax group item
            console.log('Creating new tax group item for tax type:', taxTypeId, shipping);
            await createTaxGroupItem({
              tax_group_id: Number(id),
              tax_type_id: taxTypeId,
              tax_shipping: shipping
            });
          }
        })
      );

      setOpen(true);
    } catch (err: any) {
      console.error("Error updating tax group:", err);
      setErrorMessage(err?.response?.data?.message || "Failed to update tax group");
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: theme.spacing(3), width: "100%", maxWidth: isMobile ? "100%" : "500px", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update Tax Group
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Description"
            name="description"
            size="small"
            fullWidth
            value={formData.description}
            onChange={handleDescriptionChange}
            error={!!errors.description}
            helperText={errors.description}
          />

          <Typography sx={{ mt: 2, mb: 1 }}>
            Select the taxes that are included in this group.
          </Typography>

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tax Type</TableCell>
                  <TableCell>Rate (%)</TableCell>
                  <TableCell align="center">Select</TableCell>
                  <TableCell align="center">Shipping Tax</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {taxTypes.map(tax => (
                  <TableRow key={tax.id}>
                    <TableCell>{tax.description}</TableCell>
                    <TableCell>{tax.default_rate}</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={formData.selectedTaxTypeIds.includes(tax.id)}
                        onChange={() => handleTaxTypeToggle(tax.id)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={!!formData.shippingTaxMap[tax.id]}
                        disabled={!formData.selectedTaxTypeIds.includes(tax.id)}
                        onChange={() => handleShippingTaxToggle(tax.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>

        <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 2, mt: 3 }}>
          <Button fullWidth={isMobile} onClick={() => window.history.back()} variant="outlined">Back</Button>
          <Button disabled={!canEdit} fullWidth={isMobile} variant="contained" sx={{ backgroundColor: "var(--pallet-blue)" }} onClick={handleSubmit}>Update</Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal open={open} title="Success" content="Tax Group updated successfully!" handleClose={() => setOpen(false)} onSuccess={() => window.history.back()} />
      <ErrorModal open={errorOpen} onClose={() => setErrorOpen(false)} message={errorMessage} />
    </FormPageLayout>
  );
}
