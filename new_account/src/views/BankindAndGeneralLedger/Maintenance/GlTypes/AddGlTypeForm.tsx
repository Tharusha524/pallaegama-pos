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
import { useQueryClient } from "@tanstack/react-query";
import theme from "../../../../theme";
import { createGlType } from "../../../../api/GlType/GlTypeApi";
import ErrorModal from "../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface GlTypeFormData {
  type: string;
}

export default function AddGlTypeForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Company GL setup');
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<GlTypeFormData>({ type: "" });
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<GlTypeFormData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<GlTypeFormData> = {};
    if (!formData.type.trim()) newErrors.type = "Account Type is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await createGlType({ type: formData.type.trim() });
      queryClient.invalidateQueries({ queryKey: ["glTypes"] });
      setOpen(true);
      setFormData({ type: "" });
    } catch (error: any) {
      console.error("Error saving Account Type:", error);
      setErrorMessage(
        error.response?.data?.message || "Failed to add Account Type. Please try again."
      );
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
          Add Account Type
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Account Type"
            name="type"
            size="small"
            fullWidth
            value={formData.type}
            onChange={handleInputChange}
            error={!!errors.type}
            helperText={errors.type || " "}
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
            Add New
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Account Type has been added successfully!"
        addFunc={async () => {}}
        handleClose={() => setOpen(false)}
        onSuccess={() => window.history.back()}
      />
      <ErrorModal open={errorOpen} onClose={() => setErrorOpen(false)} message={errorMessage} />
    </FormPageLayout>
  );
}
