import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
import { getTag, updateTag } from "../../../../api/CostCenterTag/CostCenterTagApi";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface CostCenterTagData {
  tagName: string;
  tagDescription: string;
}

export default function UpdateCostCenterTagsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('CostCenter tags');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<CostCenterTagData>({
    tagName: "",
    tagDescription: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CostCenterTagData, string>>>({});
  const navigate = useNavigate();

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  useEffect(() => {
    if (id) {
      getTag(id)
        .then((data) => setFormData({ tagName: data.tagName, tagDescription: data.tagDescription }))
        .catch((error) => console.error("Error fetching tag:", error));
    }
  }, [id]);

  const handleChange = (field: keyof CostCenterTagData, value: string) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof CostCenterTagData, string>> = {};
    if (!formData.tagName.trim()) newErrors.tagName = "Tag Name is required";
    if (!formData.tagDescription.trim()) newErrors.tagDescription = "Tag Description is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate() && id) {
      try {
        await updateTag(id, formData);
        setOpen(true);
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update tag Please try again."
        );
        setErrorOpen(true);
        console.error("Error updating tag:", error);
      }
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: 3, maxWidth: "500px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update CostCenter Tag
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Tag Name"
            size="small"
            fullWidth
            value={formData.tagName}
            onChange={(e) => handleChange("tagName", e.target.value)}
            error={!!errors.tagName}
            helperText={errors.tagName || " "}
          />

          <TextField
            label="Tag Description"
            size="small"
            fullWidth
            value={formData.tagDescription}
            onChange={(e) => handleChange("tagDescription", e.target.value)}
            error={!!errors.tagDescription}
            helperText={errors.tagDescription || " "}
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
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="CostCenter has been updated successfully!"
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
