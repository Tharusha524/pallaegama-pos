import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import {
  getAccountTag,
  updateAccountTag,
} from "../../../../api/AccountTag/AccountTagsApi";
import { useParams, useNavigate } from "react-router-dom";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface AccountTagFormData {
  tagName: string;
  description: string;
}

export default function UpdateAccountTags() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL Account tags');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<AccountTagFormData>({
    tagName: "",
    description: "",
  });

  const [errors, setErrors] = useState<Partial<AccountTagFormData>>({});

  useEffect(() => {
    if (id) {
      getAccountTag(Number(id)).then((data) =>
        setFormData({
          tagName: data.name,
          description: data.description || "",
        })
      );
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validate = (): boolean => {
    const newErrors: Partial<AccountTagFormData> = {};

    if (!formData.tagName) newErrors.tagName = "Tag Name is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !id) return;

    try {
      const payload = {
        name: formData.tagName,
        description: formData.description,
        type: 1,
        inactive: false,
      };

      await updateAccountTag(Number(id), payload);


      queryClient.invalidateQueries({ queryKey: ["account-tags"] });
      setOpen(true);

    } catch (err: any) {
      console.error("Error updating account tag:", err);
      setErrorMessage(
        err?.response?.data?.message ||
        "Failed to update tag Please try again."
      );
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: muiTheme.spacing(3),
          width: "100%",
          maxWidth: isMobile ? "100%" : "600px",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Update Account Tag
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Tag Name"
            name="tagName"
            size="small"
            fullWidth
            value={formData.tagName}
            onChange={handleChange}
            error={!!errors.tagName}
            helperText={errors.tagName}
          />

          <TextField
            label="Description"
            name="description"
            size="small"
            fullWidth
            value={formData.description}
            onChange={handleChange}
          />
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
            onClick={() => navigate("/bankingandgeneralledger/maintenance/account-tags")}
            variant="outlined"
          >
            Back
          </Button>

          <Button
            fullWidth={isMobile}
            variant="contained"
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={!canEdit}
          >
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Account Tag has been updated successfully!"
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
