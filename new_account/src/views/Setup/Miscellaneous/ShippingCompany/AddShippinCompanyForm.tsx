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
import { createShippingCompany } from "../../../../api/ShippingCompany/ShippingCompanyApi";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface ShippingCompanyFormData {
  shipper_name: string;
  contact: string;
  phone: string;
  phone2: string;
  address: string;
}

export default function AddShippingCompanyForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Shipping ways');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState<ShippingCompanyFormData>({
    shipper_name: "",
    contact: "",
    phone: "",
    phone2: "",
    address: "",
  });

  const [errors, setErrors] = useState<Partial<ShippingCompanyFormData>>({});

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validate = (): boolean => {
    const newErrors: Partial<ShippingCompanyFormData> = {};

    if (!formData.shipper_name) newErrors.shipper_name = "Company name is required";
    if (!formData.contact) newErrors.contact = "Contact person is required";
    if (!formData.phone) newErrors.phone = "Phone number is required";
    else if (!/^\d{10,15}$/.test(formData.phone))
      newErrors.phone = "Phone number must be 10–15 digits";

    if (formData.phone2 && !/^\d{10,15}$/.test(formData.phone2))
      newErrors.phone2 = "Secondary number must be 10–15 digits";

    if (!formData.address) newErrors.address = "Address is required";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await createShippingCompany(formData); // direct snake_case object
      setOpen(true);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to add shipping company Please try again."
      );
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          maxWidth: isMobile ? "100%" : "500px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Add Shipping Company
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Company Name"
            name="shipper_name"
            size="small"
            fullWidth
            value={formData.shipper_name}
            onChange={handleChange}
            error={!!errors.shipper_name}
            helperText={errors.shipper_name}
          />

          <TextField
            label="Contact Person"
            name="contact"
            size="small"
            fullWidth
            value={formData.contact}
            onChange={handleChange}
            error={!!errors.contact}
            helperText={errors.contact}
          />

          <TextField
            label="Phone Number"
            name="phone"
            size="small"
            fullWidth
            value={formData.phone}
            onChange={handleChange}
            error={!!errors.phone}
            helperText={errors.phone}
          />

          <TextField
            label="Secondary Number"
            name="phone2"
            size="small"
            fullWidth
            value={formData.phone2}
            onChange={handleChange}
            error={!!errors.phone2}
            helperText={errors.phone2}
          />

          <TextField
            label="Address"
            name="address"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={formData.address}
            onChange={handleChange}
            error={!!errors.address}
            helperText={errors.address}
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
          <Button
            fullWidth={isMobile}
            variant="outlined"
            onClick={() => window.history.back()}
          >
            Back
          </Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add Company
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Tax Group has been added successfully!"
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
