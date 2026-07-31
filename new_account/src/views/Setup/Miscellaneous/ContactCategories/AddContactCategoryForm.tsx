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
import { createContactCategory } from "../../../../api/ContactCategory/ContactCategoryApi";
import ErrorModal from "../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface AddContactCategoryData {
  type: string;
  subtype: string;
  name: string;
  description: string;
}


export default function AddContactCategory() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Contact categories');
  const [formData, setFormData] = useState<AddContactCategoryData>({
    type: "",
    subtype: "",
    name: "",
    description: "",
  });


  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<AddContactCategoryData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<AddContactCategoryData> = {};
    if (!formData.type.trim())
      newErrors.type = "Contact Category Type is required";
    if (!formData.subtype.trim())
      newErrors.subtype = "Contact Category Subtype is required";
    if (!formData.name.trim())
      newErrors.name = "Category Short Name is required";
    if (!formData.description.trim())
      newErrors.description = "Category Description is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
  if (validate()) {
    try {
      const payload = {
        ...formData,
        systm: false,    // default value
        inactive: false, // default value
      };
      await createContactCategory(payload);
      setOpen(true);
      setFormData({
        type: "",
        subtype: "",
        name: "",
        description: "",
      });
    } catch (error: any) {
      console.error("Error creating category:", error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to add category. Please try again."
      );
      setErrorOpen(true);
    }
  }
};


  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: 3,
          maxWidth: "600px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Add Contact Category
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Contact Category Type"
            name="type"
            size="small"
            fullWidth
            value={formData.type}
            onChange={handleInputChange}
            error={!!errors.type}
            helperText={errors.type}
          />

          <TextField
            label="Contact Category Subtype"
            name="subtype"
            size="small"
            fullWidth
            value={formData.subtype}
            onChange={handleInputChange}
            error={!!errors.subtype}
            helperText={errors.subtype}
          />

          <TextField
            label="Category Short Name"
            name="name"
            size="small"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            error={!!errors.name}
            helperText={errors.name}
          />

          <TextField
            label="Category Description"
            name="description"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            error={!!errors.description}
            helperText={errors.description}
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
            Add Category
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Contact Category has been added successfully!"
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
