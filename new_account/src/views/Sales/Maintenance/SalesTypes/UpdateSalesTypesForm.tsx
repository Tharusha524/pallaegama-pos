import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  FormControlLabel,
  Checkbox,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import theme from "../../../../theme";
import { getSalesType, updateSalesType, SalesType } from "../../../../api/SalesMaintenance/salesService";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import useFormPersist from "../../../../hooks/useFormPersist";
import { useAuth } from "../../../../context/AuthContext";

interface SalesTypeFormData {
  salesTypeName: string;
  calculationFactor: string;
  taxIncluded: boolean;
}

export default function UpdateSalesTypesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales types');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { id } = useParams<{ id: string }>();
  // Use a unique storage key for each sales type being edited
  const [formData, setFormData, clearFormData] = useFormPersist<SalesTypeFormData>(
    `update-sales-type-${id}`,
    {
      salesTypeName: "",
      calculationFactor: "",
      taxIncluded: false,
    }
  );

  const [errors, setErrors] = useState<Partial<SalesTypeFormData>>({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  // Load existing sales type data
  useEffect(() => {
    if (!id) return;
    // Only load from API if the form doesn't already have user-edited data
    if (!formData.salesTypeName && !formData.calculationFactor) {
      getSalesType(Number(id))
        .then((res: SalesType) => {
          setFormData({
            salesTypeName: res.typeName,
            calculationFactor: res.factor.toString(),
            taxIncluded: res.taxIncl,
          });
        })
        .catch((err) => {
          console.error(err);
          setErrorMessage(
            err?.response?.data?.message ||
            "Failed to load Sales Type Please try again."
          );
          setErrorOpen(true);
        });
    }
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const validate = () => {
    const newErrors: Partial<SalesTypeFormData> = {};
    if (!formData.salesTypeName) newErrors.salesTypeName = "Sales Type Name is required";
    if (!formData.calculationFactor) {
      newErrors.calculationFactor = "Calculation Factor is required";
    } else if (isNaN(Number(formData.calculationFactor))) {
      newErrors.calculationFactor = "Calculation Factor must be a number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!id) return;
    if (validate()) {
      try {
        await updateSalesType(Number(id), {
          typeName: formData.salesTypeName,
          factor: Number(formData.calculationFactor),
          taxIncl: formData.taxIncluded,
        });

        queryClient.invalidateQueries({ queryKey: ["salesTypes"] });
        
        // Clear persisted form data on successful update
        clearFormData();
        setOpen(true);

      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update Sales Type. Please try again."
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
          maxWidth: "600px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Sales Types Setup
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Sales Type Name"
            name="salesTypeName"
            size="small"
            fullWidth
            value={formData.salesTypeName}
            onChange={handleInputChange}
            error={!!errors.salesTypeName}
            helperText={errors.salesTypeName}
          />

          <TextField
            label="Calculation Factor"
            name="calculationFactor"
            size="small"
            fullWidth
            value={formData.calculationFactor}
            onChange={handleInputChange}
            error={!!errors.calculationFactor}
            helperText={errors.calculationFactor}
          />

          <FormControlLabel
            control={
              <Checkbox
                name="taxIncluded"
                checked={formData.taxIncluded}
                onChange={handleInputChange}
              />
            }
            label="Tax Included"
          />
        </Stack>

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            mt: 3,
            gap: isMobile ? 2 : 0,
          }}
        >
          <Button onClick={() => {
            // Ask user if they want to save the data for later or discard it
            if ((formData.salesTypeName || formData.calculationFactor) && 
                !confirm("Do you want to save your progress for later?")) {
              clearFormData();
            }
            navigate(-1);
          }}>Back</Button>

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
        content="Sales type has been updated successfully!"
        handleClose={() => setOpen(false)}
        onSuccess={() => {
          // Form was already cleared on successful update
          window.history.back();
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