import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
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
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import theme from "../../../../theme";
import { getGlType, updateGlType } from "../../../../api/GlType/GlTypeApi";
import ErrorModal from "../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface GlTypeFormData {
  type: string;
}

export default function UpdateGlTypeForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Company GL setup');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [formData, setFormData] = useState<GlTypeFormData>({ type: "" });
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<GlTypeFormData>>({});

  useEffect(() => {
    if (!id) return;
    const fetchGlType = async () => {
      try {
        const res = await getGlType(id);
        setFormData({ type: res.data?.type || "" });
      } catch (error) {
        console.error("Failed to fetch Account Type:", error);
      }
    };
    fetchGlType();
  }, [id]);

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
    if (!id || !validate()) return;
    try {
      await updateGlType(id, { type: formData.type.trim() });
      queryClient.invalidateQueries({ queryKey: ["glTypes"] });
      setOpen(true);
    } catch (error: any) {
      console.error("Update failed:", error);
      setErrorMessage(
        error.response?.data?.message || "Failed to update Account Type. Please try again."
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
          Update Account Type
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
          <Button onClick={() => navigate(-1)}>Back</Button>

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
        content="Account Type has been updated successfully!"
        handleClose={() => setOpen(false)}
        onSuccess={() => window.history.back()}
      />
      <ErrorModal open={errorOpen} onClose={() => setErrorOpen(false)} message={errorMessage} />
    </FormPageLayout>
  );
}
