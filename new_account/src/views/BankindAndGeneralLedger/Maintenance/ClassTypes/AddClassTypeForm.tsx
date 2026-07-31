import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { createClassType } from "../../../../api/GLAccounts/ClassTypeApi";
import { useQueryClient } from "@tanstack/react-query";
import ErrorModal from "../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface ClassTypeData {
  type_name?: string;
}

export default function AddClassTypeForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Class Types (GL)');
  const [formData, setFormData] = useState<ClassTypeData>({ type_name: "" });
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<ClassTypeData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<ClassTypeData> = {};
    if (!formData.type_name) newErrors.type_name = "Type name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createClassType(formData);
      await queryClient.refetchQueries({ queryKey: ["classTypes"] });
      setOpen(true);
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
          "Failed to add Class Type Please try again."
      );
      setErrorOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: theme.spacing(3), maxWidth: "600px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Add Class Type
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Type Name"
            name="type_name"
            size="small"
            fullWidth
            value={formData.type_name}
            onChange={handleInputChange}
            error={!!errors.type_name}
            helperText={errors.type_name || " "}
          />
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0 }}>
          <Button onClick={() => window.history.back()}>Back</Button>
          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={isSubmitting || !canEdit}
          >
            {isSubmitting ? "Adding..." : "Add New"}
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Class Type has been added successfully!"
        addFunc={async () => {}}
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
