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
import {
  getContactCategory,
  updateContactCategory,
  ContactCategory,
} from "../../../../api/ContactCategory/ContactCategoryApi";
import { useParams } from "react-router";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface UpdateContactCategoryData {
  type: string;
  subtype: string;
  name: string;
  description: string;
  systm: boolean;
  inactive: boolean;
}


export default function UpdateContactCategory() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Contact categories');
  const { id } = useParams();
  const [formData, setFormData] = useState<UpdateContactCategoryData>({
  type: "",
  subtype: "",
  name: "",
  description: "",
  systm: false,
  inactive: false,
});


  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<UpdateContactCategoryData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          const data = await getContactCategory(Number(id));
          setFormData(data);
        } catch (error) {
          console.error("Error fetching category:", error);
        }
      }
    };
    fetchData();
  }, [id]);

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;

  let newValue: string | boolean = value;

  // Check if this is a checkbox
  if ((e.target as HTMLInputElement).type === "checkbox") {
    newValue = (e.target as HTMLInputElement).checked;
  }

  setFormData({
    ...formData,
    [name]: newValue,
  });

  setErrors({ ...errors, [name]: "" });
};




  const validate = () => {
    const newErrors: Partial<UpdateContactCategoryData> = {};
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
        await updateContactCategory(Number(id), formData);
        setOpen(true);
      } catch (error) {
        console.error("Error updating category:", error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update contact category Please try again."
        );
        setErrorOpen(true);;
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
          Update Contact Category
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
            disabled={formData.systm}
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
            disabled={formData.systm}
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
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Contact Category has been updated successfully!"
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
