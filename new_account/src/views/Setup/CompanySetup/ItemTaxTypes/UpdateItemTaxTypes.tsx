import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Checkbox,
} from "@mui/material";
import theme from "../../../../theme";
import { getItemTaxType, updateItemTaxType } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { getTaxTypes } from "../../../../api/Tax/taxServices";
import { createItemTaxTypeExemption, deleteItemTaxTypeExemption, getItemTaxTypeExemptions } from "../../../../api/ItemTaxTypeException/ItemTaxTypeExceptionApi";
import { useParams, useNavigate } from "react-router-dom";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface TaxType {
  id: number;
  description: string;
  default_rate: number;
}

interface ItemTaxTypeFormData {
  description: string;
  isFullyTaxExempt: string;
  selectedTaxTypes: number[];
}

export default function UpdateItemTaxTypes() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Item tax type definitions');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { id } = useParams<{ id: string }>();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [formData, setFormData] = useState<ItemTaxTypeFormData>({
    description: "",
    isFullyTaxExempt: "",
    selectedTaxTypes: [],
  });
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [errors, setErrors] = useState<Partial<ItemTaxTypeFormData>>({});
  const [loading, setLoading] = useState(false);

  // Fetch tax types and existing data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tax types
        const taxTypesData = await getTaxTypes();
        setTaxTypes(taxTypesData);

        if (!id) return;

        // Fetch item tax type data
        const itemTaxType = await getItemTaxType(id);

        // Fetch existing exceptions
        const exceptions = await getItemTaxTypeExemptions();
        const selectedTaxIds = exceptions
          .filter((exc: any) => exc.item_tax_type_id === Number(id))
          .map((exc: any) => exc.tax_type_id);

        setFormData({
          description: itemTaxType.name,
          isFullyTaxExempt: itemTaxType.exempt ? "yes" : "no",
          selectedTaxTypes: selectedTaxIds,
        });
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setErrorMessage("Failed to load item tax type data. Please try again.");
        setErrorOpen(true);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement> | any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset selected tax types when changing to "yes"
      selectedTaxTypes: name === 'isFullyTaxExempt' && value === 'yes' ? [] : prev.selectedTaxTypes
    }));
  };

  const handleTaxTypeToggle = (taxTypeId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedTaxTypes: prev.selectedTaxTypes.includes(taxTypeId)
        ? prev.selectedTaxTypes.filter(id => id !== taxTypeId)
        : [...prev.selectedTaxTypes, taxTypeId]
    }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<ItemTaxTypeFormData> = {};
    if (!formData.description) {
      newErrors.description = "Description is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        setLoading(true);
        // Update item tax type
        const payload = {
          name: formData.description,
          exempt: formData.isFullyTaxExempt === 'yes'
        };

        await updateItemTaxType(id, payload);

        // Handle tax type exceptions
        if (formData.isFullyTaxExempt === 'no') {
          // Get current exceptions
          const currentExceptions = await getItemTaxTypeExemptions();
          const currentTaxTypeIds = currentExceptions
            .filter((exc: any) => exc.item_tax_type_id === Number(id))
            .map((exc: any) => exc.tax_type_id);

          // Remove exceptions that are no longer selected
          const exceptionsToRemove = currentTaxTypeIds.filter(
            taxId => !formData.selectedTaxTypes.includes(taxId)
          );

          // Add new exceptions
          const exceptionsToAdd = formData.selectedTaxTypes.filter(
            taxId => !currentTaxTypeIds.includes(taxId)
          );

          // Process removals
          await Promise.all(
            exceptionsToRemove.map(taxId =>
              deleteItemTaxTypeExemption(Number(id), taxId)
            )
          );

          // Process additions
          await Promise.all(
            exceptionsToAdd.map(taxId =>
              createItemTaxTypeExemption({
                item_tax_type_id: Number(id),
                tax_type_id: taxId
              })
            )
          );
        } else {
          // If fully tax exempt, remove all exceptions
          const currentExceptions = await getItemTaxTypeExemptions();
          await Promise.all(
            currentExceptions
              .filter((exc: any) => exc.item_tax_type_id === Number(id))
              .map((exc: any) => deleteItemTaxTypeExemption(Number(id), exc.tax_type_id))
          );
        }

        setOpen(true);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update item tax type. Please try again."
        );
        setErrorOpen(true);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          width: "100%",
          maxWidth: isMobile ? "100%" : "500px",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Update Item Tax Type
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Description"
            name="description"
            size="small"
            fullWidth
            value={formData.description}
            onChange={handleChange}
            error={!!errors.description}
            helperText={errors.description}
          />

          <FormControl fullWidth={false} sx={{ width: 150 }}>
            <InputLabel id="tax-exempt-label">Is Fully Tax-exempt</InputLabel>
            <Select
              labelId="tax-exempt-label"
              id="isFullyTaxExempt"
              name="isFullyTaxExempt"
              value={formData.isFullyTaxExempt}
              label="Is Fully Tax-exempt"
              onChange={handleChange}
            >
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
          </FormControl>

          {formData.isFullyTaxExempt === 'no' && (
            <>
              <Typography sx={{ mt: 2, mb: 1 }}>
                Select which taxes this item tax type is exempt from.
              </Typography>
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tax Name</TableCell>
                      <TableCell align="right">Rate (%)</TableCell>
                      <TableCell align="center">Is exempt</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {taxTypes.map((tax) => (
                      <TableRow key={tax.id}>
                        <TableCell>{tax.description}</TableCell>
                        <TableCell align="right">{tax.default_rate}</TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={formData.selectedTaxTypes.includes(tax.id)}
                            onChange={() => handleTaxTypeToggle(tax.id)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            gap: 2,
            mt: 3,
          }}
        >
          <Button
            fullWidth={isMobile}
            onClick={() => window.history.back()}
            variant="outlined"
          >
            Back
          </Button>

          <Button
            fullWidth={isMobile}
            variant="contained"
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={loading || !canEdit}
          >
            {loading ? "Updating..." : "Update"}
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Item Tax Type has been updated successfully!"
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
