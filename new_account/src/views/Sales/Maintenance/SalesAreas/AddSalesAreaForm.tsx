import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import theme from "../../../../theme";
import { createSalesArea } from "../../../../api/SalesMaintenance/salesService";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import useFormPersist from "../../../../hooks/useFormPersist";
import { useAuth } from "../../../../context/AuthContext";

interface SalesAreaFormData {
  name: string;
}

export default function AddSalesAreaForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales areas maintenance');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData, clearFormData] = useFormPersist<SalesAreaFormData>(
    "sales-area-form",  // unique key for this form
    { name: "" }
  );
  const [error, setError] = useState<string>("");
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData({ name: value });
  };

  const validate = () => {
    if (!formData.name.trim()) {
      setError("Area Name is required");
      return false;
    }
    setError("");
    return true;
  };

  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (validate()) {
      try {
        await createSalesArea(formData);
        queryClient.invalidateQueries({ queryKey: ["salesAreas"] });
        // Clear form data from localStorage on successful submission
        clearFormData();
        setOpen(true);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to add Sales Area Please try again."
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
          maxWidth: "500px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Sales Area Setup
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Area Name"
            name="name"
            size="small"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            error={!!error}
            helperText={error}
          />
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0, }}>
          <Button onClick={() => {
            // Ask user if they want to save the data for later or discard it
            if (formData.name && !confirm("Do you want to save your progress for later?")) {
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
            Add New
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Sales area has been added successfully!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => {
          // Form was already cleared on successful submission
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
