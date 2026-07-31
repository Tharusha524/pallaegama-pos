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
import { createItemTaxType } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { getTaxTypes } from "../../../../api/Tax/taxServices";
import { createItemTaxTypeExemption } from "../../../../api/ItemTaxTypeException/ItemTaxTypeExceptionApi";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
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

export default function AddItemTaxTypes() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Item tax type definitions');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [formData, setFormData] = useState<ItemTaxTypeFormData>({
    description: "",
    isFullyTaxExempt: "no",
    selectedTaxTypes: [],
  });

  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [errors, setErrors] = useState<Partial<ItemTaxTypeFormData>>({});

  // Fetch tax types
  useEffect(() => {
    getTaxTypes().then(setTaxTypes);
  }, []);

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
        // First, create the item tax type
        const payload = {
          name: formData.description,
          exempt: formData.isFullyTaxExempt === 'yes'
        };

        const createdItemTaxType = await createItemTaxType(payload);

        // If not fully tax-exempt and we have selected tax types, create the exceptions
        if (formData.isFullyTaxExempt === 'no' && createdItemTaxType?.id) {
          const exceptionPromises = formData.selectedTaxTypes.map(taxTypeId =>
            createItemTaxTypeExemption({
              item_tax_type_id: createdItemTaxType.id,
              tax_type_id: taxTypeId
            })
          );

          try {
            await Promise.all(exceptionPromises);
          } catch (exceptionError) {
            console.error("Error creating exceptions:", exceptionError);
            setErrorMessage("Item Tax Type was created but failed to set up tax exceptions. Please try again.");
            setErrorOpen(true);
            return;
          }
        }

        setOpen(true);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to add Item Tax Type. Please try again."
        );
        setErrorOpen(true);
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
          Item Tax Type Setup
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

          <Button disabled={!canEdit}
            fullWidth={isMobile}
            variant="contained"
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add New
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Item Tax Type has been added successfully!"
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
